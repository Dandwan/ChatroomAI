# responses-api.ts

## 功能
OpenAI Responses API ↔ Chat Completions API 双向格式转换器。

Responses API 与 Chat Completions 的差异：
- `input[]` 数组代替 `messages[]`
- 内容类型：`input_text`/`input_image`/`input_file` 代替 `text`/`image_url`/`file`
- `reasoning.effort` 嵌套字段代替顶层 `reasoning_effort`
- 响应格式：`output[]` 代替 `choices[]`
- 流式格式：`response.created`/`response.output_text.delta`/`response.completed` 事件代替标准 SSE

提供两个方向的请求转换器、响应转换器和流式 SSE TransformStream。

## 关系
### 调用 / 引用
- `../logger.js` — 日志

### 提供
- `responsesToChatCompletionsRequest(body)` — Responses API 请求 → Chat Completions 请求
- `chatCompletionsToResponsesRequest(body)` — Chat Completions 请求 → Responses API 请求
- `chatCompletionsToResponsesResponse(body, modelName?)` — Chat Completions 响应 → Responses API 响应
- `createResponsesStreamTransformer(modelName?)` — SSE 流式转换 TransformStream

### 被依赖
- `proxy-routes.ts`

## 关键词
### 函数
- `responsesToChatCompletionsRequest`
- `chatCompletionsToResponsesRequest`
- `chatCompletionsToResponsesResponse`
- `createResponsesStreamTransformer`
- `convertInputItemToMessage`
- `convertMessageToInputItem`
