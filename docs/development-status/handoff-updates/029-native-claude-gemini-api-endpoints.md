# 029 — 原生 Claude API 和 Gemini API 端点支持

**日期**：2026-06-05

## 范围

为 ActiNet 云服务新增两种原生 API 端点，让客户端可以直接使用 Anthropic Messages API 和 Google Generative Language API 格式进行调用。使用 OpenAI 格式作为内部枢纽（pivot），最小化新增代码量。

## 设计决策

1. **OpenAI 格式作为内部枢纽**：新端点接受原生格式 → 转换为 OpenAI → 复用现有上游选择/转发/重试逻辑 → 转换回原生格式返回。避免 O(N×M) 的全组合转换矩阵。
2. **双 transformer 链式管道**：`request-forwarder.ts` 新增 `outputTransformer` 参数，流式转发支持 upstream → T1（上游→OpenAI）→ T2（OpenAI→原生）→ 客户端 的链式转换。
3. **Gemini 流式双模式**：同时支持 `:streamGenerateContent` 和 `:generateContent?alt=sse` 两种流式方式，`getRouting()` 新增 `geminiStreamMode` 参数控制上游路径。
4. **模型列表多格式**：`GET /v1/models` 根据 `anthropic-version` 请求头自动切换 OpenAI/Anthropic 格式；`GET /v1beta/models` 使用 Gemini 格式。

## 新增端点

### Anthropic Messages API（挂载于 `/v1`）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1/messages` | Anthropic Messages API（流式/非流式） |
| GET | `/v1/models` | 模型列表（根据 `anthropic-version` 头自动切换 OpenA/Anthropic 格式） |

### Gemini API（挂载于 `/v1beta`）
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/v1beta/models/:model/generateContent` | Gemini 非流式；`?alt=sse` 启用流式 |
| POST | `/v1beta/models/:model/streamGenerateContent` | Gemini 流式 |
| GET | `/v1beta/models` | Gemini 格式模型列表 |

## 代码变更

### 新建：共享转发核心（`proxy-routes.ts` 内部）
- `forwardChatCompletion()` — 从原 `/v1/chat/completions` 路由处理函数中提取，供三个端点类型共用
- `ForwardChatOptions` / `ForwardChatResult` 接口

### 修改：`request-forwarder.ts`
- `StreamForwardOptions` 新增 `outputTransformer?: TransformStream<string, string>` — 第二级转换器
- `forwardStreamRequest()` 新增双 transformer 链式管道逻辑（t1+t2 / t1-only / t2-only / direct）

### 修改：`format-converter.ts` — 新增 3 个反向转换器
- `anthropicToOpenaiRequest()` — Anthropic 请求 → OpenAI 请求（system 字段→system 消息、content blocks→OpenAI content）
- `openaiToAnthropicResponse()` — OpenAI 响应 → Anthropic 响应（choices→content[]、finish_reason→stop_reason）
- `createOpenaiToAnthropicStreamTransformer()` — OpenAI SSE → Anthropic SSE（message_start/content_block_start/content_block_delta/message_delta/message_stop 事件映射）

### 修改：`format-gemini.ts` — 新增 3 个反向转换器
- `geminiToOpenaiRequest()` — Gemini 请求 → OpenAI 请求（contents→messages、systemInstruction→system、generationConfig→参数）
- `openaiToGeminiResponse()` — OpenAI 响应 → Gemini 响应（choices→candidates、usage→usageMetadata）
- `createOpenaiToGeminiStreamTransformer()` — OpenAI SSE → Gemini SSE（delta→candidates[0].content.parts[0].text）

### 修改：`proxy-routes.ts` — 重构 + 新增端点
- 提取 `forwardChatCompletion()` 共享核心
- 新增 `POST /v1/messages` 端点（Anthropic → OpenAI → 转发 → Anthropic）
- 新增 `createGeminiRoutes()` 导出函数（Gemini 端点）
- `/v1/models` 支持 Anthropic 格式（根据 `anthropic-version` 头检测）
- `getRouting()` 新增 `geminiStreamMode` 参数（`'streamGenerateContent'` | `'sse'`）

### 修改：`app.ts`
- 导入 `createGeminiRoutes`
- 挂载 Gemini 路由：`/v1beta` 和 `/api/v1beta`

### 修改文件清单
| 文件 | 操作 |
|------|------|
| `cloud-server/src/proxy/request-forwarder.ts` | 修改 — outputTransformer 支持 |
| `cloud-server/src/proxy/format-converter.ts` | 修改 — 3 个反向转换器 |
| `cloud-server/src/proxy/format-gemini.ts` | 修改 — 3 个反向转换器 |
| `cloud-server/src/proxy/proxy-routes.ts` | 重写 — 共享核心 + 新端点 |
| `cloud-server/src/app.ts` | 修改 — Gemini 路由挂载 |

### 代码摘要更新
- `summaries/cloud-server/src/proxy/request-forwarder.ts.md`
- `summaries/cloud-server/src/proxy/format-converter.ts.md`
- `summaries/cloud-server/src/proxy/format-gemini.ts.md`
- `summaries/cloud-server/src/proxy/proxy-routes.ts.md`
- `summaries/cloud-server/src/app.ts.md`

## 数据流

### Anthropic 端点流式调用（上游为 OpenAI）
```
客户端 POST /v1/messages (Anthropic 格式, stream:true)
  → anthropicToOpenaiRequest() → OpenAI body
  → forwardChatCompletion() → 上游选择/转发/重试
    → upstream SSE (OpenAI) → createOpenaiToAnthropicStreamTransformer() → Anthropic SSE → 客户端
```

### Anthropic 端点流式调用（上游为 Anthropic）
```
客户端 POST /v1/messages (Anthropic 格式, stream:true)
  → anthropicToOpenaiRequest() → OpenAI body
  → forwardChatCompletion() → 上游选择/转发/重试
    → upstream SSE (Anthropic) → createAnthropicStreamTransformer() (T1: Anthropic→OpenAI)
      → createOpenaiToAnthropicStreamTransformer() (T2: OpenAI→Anthropic) → Anthropic SSE → 客户端
```

### Gemini 端点（上游为 OpenAI）
```
客户端 POST /v1beta/models/gpt-4o:generateContent (Gemini 格式)
  → geminiToOpenaiRequest() → OpenAI body
  → forwardChatCompletion() → 上游选择/转发/重试
    → upstream response (OpenAI) → openaiToGeminiResponse() → Gemini 响应 → 客户端
```

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误

## 决策关卡

- 方案已提出：是（含详细工程方案、数据流图、6 个反向转换器设计）
- 用户确认已收到：是
- 用户决策：
  1. Gemini 流式同时提供 `:streamGenerateContent` 和 `?alt=sse` 两种方式，上游也支持两种
  2. Anthropic `anthropic-version` 头不强制要求，透传
  3. 同时提供 Anthropic/Gemini 格式模型列表

## 已知限制

1. **流式双转换 token 消耗**：Anthropic 端点连 Anthropic 上游时，流经过 2 次 TransformStream 转换（Anthropic→OpenAI→Anthropic），增加少量 CPU 开销
2. **Anthropic 高级字段**：`tool_use`、`computer_use`、`citations` 等高级内容块类型暂不映射
3. **Gemini `safetySettings`**：Gemini 的安全设置字段在转换过程中丢失
4. **图片多模态**：Anthropic `source` → OpenAI `image_url` 映射仅支持 base64 data URL，不支持 HTTP URL
5. **流式 token 统计**：反向转换器（OpenAI→Anthropic）的 token 统计依赖 OpenAI SSE 中的 `usage` 字段，如果上游不在流中返回 usage，输出 token 数不准确

## 下一步

- 部署到云服务器验证三种 API 端点的实际表现
- 用 Claude SDK 测试 `POST /v1/messages` 端点
- 用 Gemini SDK 测试 `POST /v1beta/models/...` 端点
- 验证流式双转换（Anthropic→OpenAI→Anthropic）的正确性和性能
- 可选的后续增强：
  - 支持 Anthropic `tool_use` 内容块类型映射
  - 支持 Gemini `safetySettings` 和 `tools` 配置
  - 更好的 token 统计算法（不完全依赖 usage 字段）
