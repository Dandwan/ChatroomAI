# `cloud-server/src/proxy/format-converter.ts`

## 功能
OpenAI ↔ Anthropic API 格式转换模块。提供请求体转换（OpenAI → Anthropic）、非流式响应转换（Anthropic → OpenAI）和 SSE 流式事件转换（Anthropic SSE → OpenAI SSE）。

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `openaiToAnthropicRequest()` — 将 OpenAI 格式的请求体转换为 Anthropic Messages API 格式
- `anthropicToOpenaiResponse()` — 将 Anthropic 非流式响应转换为 OpenAI chat completion 格式
- `createAnthropicStreamTransformer()` — 创建 TransformStream，将 Anthropic SSE 流转换为 OpenAI SSE 流

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts` — 根据上游 API 类型调用格式转换

## 关键词
### 函数
- `openaiToAnthropicRequest`
- `anthropicToOpenaiResponse`
- `createAnthropicStreamTransformer`
- `createOpenAIChunk`
