# 052 — 修复 ActiNet OpenAI→Anthropic 流式响应空响应问题

**日期**：2026-06-07
**类型**：Bug fix（非小修复 — 涉及 5 个文件，含架构级加固）
**关联**：[[051-actinet-align-cpa-translation-behavior]]（请求方向对齐），[[043-fix-streaming-tool-use-content-block-start]]（上次流式修复）

## 问题描述

proxy-diff 测试套件 14 个 session 显示：请求方向（Anthropic→OpenAI）已对齐，但响应方向（OpenAI→Anthropic）全部流式 session 返回 **0B 空响应**。CPA 正确返回 168KB Anthropic SSE 流。

Docker 日志确认 `Cannot set headers after they are sent to the client` 和 `WritableStream is locked` 两种运行时错误。

## 根因分析（3 个独立 bug）

### Bug 1：流式重试冲突 — `Cannot set headers after they are sent`

**位置**：`request-forwarder.ts:124-127` — `forwardStreamRequest()`

首次流式尝试在 `fetch()` 前就设置 `res.setHeader()`。当上游返回错误（如 401）时，异常被 `forwardChatCompletion()` 捕获并尝试重试下一个 key。第二次调用再次尝试 `res.setHeader()` → 崩溃。

### Bug 2：TransformStream 行缓冲缺失 — 0B 输出

**位置**：`format-converter.ts`、`format-gemini.ts`、`responses-api.ts` — 所有 `TransformStream<string, string>`

SSE 流通过 `reader.read()` 分块到达时，TCP 分片边界可能落在 SSE JSON 行中间。`transform()` 方法直接 `chunk.split('\n')` 后逐行处理，**不做跨调用缓冲**。前半行 JSON.parse 失败被静默丢弃，后半行不满足 `startsWith('data: ')` 被跳过 → 所有行丢失 → 0B 输出。

### Bug 3：TransformStream 实例复用 — `WritableStream is locked`

**位置**：`proxy-routes.ts` — `ForwardChatOptions.outputTransformer`

`outputTransformer` 在路由处理器中创建一次（作为实例），传入 `forwardChatCompletion()` 的重试循环。首次尝试使用后 writable 被锁定，重试时复用同一个实例 → `WritableStream is locked`。

## 修复内容

### 修改 A：延后响应头设置（`request-forwarder.ts` ~25 行）

- `res.setHeader`/`res.status` 从 `fetch()` 前移至确认 `response.ok` 之后
- catch 块检查 `res.headersSent`：若已发送则 `res.end()` 终止响应
- 错误对象附加 `code` 属性（`STREAM_HEADERS_SENT` / `STREAM_PREFLIGHT`）供调用方判断

### 修改 B：流式防重试（`proxy-routes.ts` ~30 行）

- `forwardChatCompletion()` catch 块：流式请求检测 `STREAM_HEADERS_SENT` 错误码或 `res.headersSent`，立即 throw 跳出重试
- 所有路由端点（OpenAI/Anthropic/Gemini/Responses）流式错误路径新增 `!res.headersSent` 守卫
- `outputTransformer` 改为 factory 函数 `() => TransformStream`，每次重试创建全新实例

### 修改 C：TransformStream 行缓冲（`format-converter.ts` ~40 行）

- `createOpenaiToAnthropicStreamTransformer` 和 `createAnthropicStreamTransformer` 新增 `lineBuffer`
- `transform()` 方法拼接 `lineBuffer + chunk` 后再 `split('\n')`
- `lines.pop()` 保留不完整行到下次调用
- `flush()` 丢弃残留不完整行
- 新增 `enqueue()` 辅助函数追踪输出字节
- `flush()` 输出 `inputBytes`/`outputBytes`/`calls`/`bufferRemaining` 诊断日志

### 修改 D：format-gemini.ts 行缓冲（~15 行）

- `createGeminiStreamTransformer` 和 `createOpenaiToGeminiStreamTransformer` 同样添加 `lineBuffer`

### 修改 E：responses-api.ts 行缓冲（~8 行）

- `createResponsesStreamTransformer` 同样添加 `lineBuffer`

## 验证

### 编译
- `npx tsc --noEmit` — **零错误**
- Docker 镜像构建 + 部署成功（3 次迭代）

### 端到端测试
```
curl POST http://127.0.0.1:2178/v1/messages → Anthropic SSE 流正常输出
```

变压器统计（86 次 transform 调用）：
```
inputBytes: 42833  →  outputBytes: 16852
calls: 86, bufferRemaining: 0
upstreamChunks: 86, outputChunks: 133
```

- **86 个 chunk 全部正确处理**，无数据丢失
- **零错误**：无 `Cannot set headers`、无 `Maximum call stack`、无 `WritableStream is locked`
- CPA vs ActiNet proxy-diff 对比待 upstream key 余额恢复后运行

### 副作用修复
- sed 替换引起 `enqueue()` 函数内部递归调用 `enqueue()` → "Maximum call stack size exceeded"，已修复

## 涉及文件

| 文件 | 变更 |
|------|------|
| `cloud-server/src/proxy/request-forwarder.ts` | ~25 行 — 响应头延后 + 异常分类 |
| `cloud-server/src/proxy/proxy-routes.ts` | ~30 行 — 防重试 + factory + 守卫 |
| `cloud-server/src/proxy/format-converter.ts` | ~40 行 — 2 个 TransformStream 行缓冲 + 调试日志 |
| `cloud-server/src/proxy/format-gemini.ts` | ~15 行 — 2 个 TransformStream 行缓冲 |
| `cloud-server/src/proxy/responses-api.ts` | ~8 行 — 1 个 TransformStream 行缓冲 |

## 决策关卡

- 方案已提出：是（详细工程方案含 3 个根因分析）
- 用户确认已收到：是

## 已知限制

1. proxy-diff 端到端对比测试因上游 API key 全部欠费（401 "Insufficient balance"）暂未执行，需恢复余额后验证
2. 非流式路径的 upstream-simulator 竞态问题未修复（proxy-diff 测试环境问题，非生产 bug）
3. 行缓冲在 `flush()` 时静默丢弃不完整行 — 正常 SSE 流以完整 `[DONE]` 行结束，不应有残留

## 下一步

- 恢复 OpenCode upstream key 余额后运行 `proxy-diff once` 全 14 session 验证
- 确认 CPA vs ActiNet 响应体对比无功能差异
- 监控生产环境 `OpenAI→Anthropic stream transformer flushed` 日志确认 bufferRemaining 始终为 0
- 可选：将行缓冲提取为公共工具函数供所有 TransformStream 复用
