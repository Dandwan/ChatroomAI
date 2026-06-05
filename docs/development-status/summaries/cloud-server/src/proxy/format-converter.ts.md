# `cloud-server/src/proxy/format-converter.ts`

## 功能
OpenAI ↔ Anthropic API 格式转换模块。提供请求体转换（双向）、非流式响应转换（双向）和 SSE 流式事件转换（双向）。**v8: 新增反向转换器 `anthropicToOpenaiRequest()`、`openaiToAnthropicResponse()`、`createOpenaiToAnthropicStreamTransformer()`，支持原生 Anthropic Messages API 端点。** Openai→Anthropic 响应转换支持推理模型的 `reasoning_content` → `thinking` block 映射（非流式+流式）。

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `openaiToAnthropicRequest()` — 将 OpenAI 格式的请求体转换为 Anthropic Messages API 格式
- `anthropicToOpenaiResponse()` — 将 Anthropic 非流式响应转换为 OpenAI chat completion 格式
- `createAnthropicStreamTransformer()` — 创建 TransformStream，将 Anthropic SSE 流转换为 OpenAI SSE 流
- `anthropicToOpenaiRequest()` — **v8** 反向：Anthropic Messages API 请求 → OpenAI chat completions 格式
- `openaiToAnthropicResponse()` — **v8** 反向：OpenAI chat completion 响应 → Anthropic Messages API 格式
- `createOpenaiToAnthropicStreamTransformer()` — **v8** 反向：OpenAI SSE 流 → Anthropic SSE 流（message_start/content_block_start/content_block_delta/message_delta/message_stop 事件）

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts` — 根据上游/客户端 API 类型调用格式转换

## 关键词
### 函数
- `openaiToAnthropicRequest`
- `anthropicToOpenaiResponse`
- `createAnthropicStreamTransformer`
- `anthropicToOpenaiRequest`
- `openaiToAnthropicResponse`
- `createOpenaiToAnthropicStreamTransformer`
- `createOpenAIChunk`
