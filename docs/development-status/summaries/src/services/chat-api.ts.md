# `src/services/chat-api.ts`

## 功能
ActiChat 的 LLM API 通信层。提供流式（`requestStreamCompletion`）和非流式（`requestNonStreamCompletion`）聊天补全请求，支持所有服务商（含 ActiNet）的通用 OpenAI Chat Completions 格式。包含请求体构建、SSE 解析、token 统计、错误消息提取、以及 AbortSignal 超时保护。

## 关系
### 调用 / 引用
- `src/App.tsx` — 通过 `RequestSettings` 接口注入配置
- 浏览器 `fetch` API
- `AbortSignal` API（`any`、`timeout`）

### 提供
- `requestStreamCompletion()` — 流式请求，返回 `CompletionResult`（含首 token 延迟和 token 统计）
- `requestNonStreamCompletion()` — 非流式请求，返回 `CompletionResult`
- `buildApiUrl()` — 拼接 API URL
- `authHeaders()` — 构建 Authorization Bearer 头
- `readErrorMessage()` — 从 HTTP 响应提取错误消息
- `normalizeUsage()` — 标准化 token 统计
- `buildCompletionPayload()` — 构建请求体
- `RequestSettings` / `ApiMessage` / `CompletionResult` — 接口

### 被依赖
- `src/App.tsx` — 聊天请求入口

## 关键词
### 函数
- `requestStreamCompletion`
- `requestNonStreamCompletion`
- `buildApiUrl`
- `authHeaders`
- `readErrorMessage`
- `normalizeUsage`
- `readStructuredText`
- `buildCompletionPayload`
### 接口
- `RequestSettings`
- `ApiMessage`
- `ApiContentPart`
- `CompletionResult`
- `StreamCallbacks`
- `TokenUsage`
