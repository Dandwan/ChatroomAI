# 058 — 修复 Anthropic 非流式 Passthrough Content 为空 Bug

**日期**：2026-06-07
**状态**：已修复、已部署、已验证

## 问题

通过 ActiNet 的 `POST /v1/messages` (Anthropic 原生端点) 发送非流式请求时，
response body 中 `content` 始终为空数组 `[]`，且 `usage` 中所有 token 计数为 0。
流式请求不受影响。

### 影响

- 所有 Anthropic→Anthropic 同格式直通的非流式请求（client apiType == upstream apiType == 'anthropic'）
- 典型场景：Claude Code 通过 ActiNet 调用 Claude中转站的非流式请求
- 流式请求不受影响（SSE 直接透传，绕过响应后处理）

## 根因

**双重重入转换（Double Conversion Bug）**——`smart-router.ts` 正确检测到 `canPassthrough=true`，
但 handler 层 (`/v1/messages` route) 和 `forwardChatCompletion` 的请求/响应处理未完全遵守 passthrough 语义。

### 请求方向

```
Client Anthropic body
  ↓ line 619: anthropicToOpenaiRequest() → OpenAI body
  ↓ forwardChatCompletion: canPassthrough=true → 跳过 reqConv
  ↓ 上游收到: OpenAI body + /v1/messages 路径（格式不匹配）
  ↓ 上游恰好兼容两种格式 → 不报错，返回 Anthropic 格式响应
```

### 响应方向（非流式）

```
上游返回 Anthropic JSON: {content: [{"text":"Hi","type":"text"}], usage: {input_tokens:4108,...}}
  ↓ forwardNonStreamRequest: 返回原始 Anthropic JSON（resConv=null）
  ↓ line 677: openaiToAnthropicResponse(responseBody)
  ↓ 期望 OpenAI 输入: choices[0].message.content → undefined
  ↓ 期望 OpenAI 输入: usage.prompt_tokens → undefined
  ↓ 输出: content:[], usage:{input_tokens:0, output_tokens:0}
```

Token 计数辅助 Bug：`forwardNonStreamRequest` 仅识别 OpenAI 的 `prompt_tokens`/`completion_tokens`，
不识别 Anthropic 的 `input_tokens`/`output_tokens`。

## 修改

### 文件 1: `cloud-server/src/proxy/proxy-routes.ts`（~20 行修改）

1. **`ForwardChatOptions`** — 新增 `rawClientBody?: Record<string, unknown>` 字段，保存客户端原生格式请求体
2. **`ForwardChatResult`** — 新增 `responseIsNative?: boolean` 字段，标记响应是否已是客户端原生格式
3. **`forwardChatCompletion` 请求体选择** — 当 `plan.canPassthrough && rawClientBody` 时，直接使用客户端原生 body，跳过 OpenAI pivot
4. **`forwardChatCompletion` 成功返回** — 设置 `responseIsNative: plan.canPassthrough`
5. **`/v1/messages` handler** — 传入 `rawClientBody: body`（原始 Anthropic 请求体）
6. **`/v1/messages` handler 非流式响应** — 当 `result.responseIsNative` 时，直接返回原始响应，跳过 `openaiToAnthropicResponse()` 转换

### 文件 2: `cloud-server/src/proxy/request-forwarder.ts`（3 行修改）

7. **`forwardNonStreamRequest` token 计数** — 兼容 Anthropic 格式：
   ```
   promptTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0
   completionTokens = usage.completion_tokens ?? usage.output_tokens ?? 0
   totalTokens = usage.total_tokens ?? (promptTokens + completionTokens)
   ```

### 无需修改

- `smart-router.ts` — `canPassthrough` 逻辑本身正确
- `format-converter.ts` — 转换函数无 bug，只是被错误调用

## 验证

| 测试项 | 结果 |
|--------|------|
| `npx tsc --noEmit` | ✅ 零错误 |
| claude-opus-4-6 非流式 | ✅ `content: "Hi"`, `input_tokens: 4108` |
| claude-opus-4-7 非流式 | ✅ `content: "Hi"`, `input_tokens: 5882` |
| claude-opus-4-8 非流式 | ✅ `content: "Hi"`, `input_tokens: 6392` |
| claude-opus-4-8 流式 | ✅ SSE 正常流式推送 |
| OpenAI 端点 (`/v1/chat/completions`) | ✅ 不受影响 |

## 涉及文件

| 文件 | 变更行数 | 变更内容 |
|------|---------|---------|
| `cloud-server/src/proxy/proxy-routes.ts` | +20 / -8 | passthrough body/response 处理 |
| `cloud-server/src/proxy/request-forwarder.ts` | +3 / -3 | Anthropic token 计数兼容 |

## 决策关卡

- 方案已提出：是（含完整根因分析、调用链追踪、alternatives 对比）
- 用户确认已收到：是
