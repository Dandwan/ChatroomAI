# `cloud-server/src/proxy/format-gemini.ts`

## 功能
OpenAI ↔ Gemini (Google Generative Language API) 格式转换模块。提供请求体转换（双向）、非流式响应转换（双向）和 SSE 流式事件转换（双向）。支持系统消息→systemInstruction、多模态图片 inlineData、finishReason 映射和 usageMetadata token 统计。**v8: 新增反向转换器 `geminiToOpenaiRequest()`、`openaiToGeminiResponse()`、`createOpenaiToGeminiStreamTransformer()`，支持原生 Gemini API 端点。** **v11: `openaiToGeminiRequest()` 新增 OpenAI `reasoning_effort` → Gemini `thinkingConfig` 映射（Gemini 3 用 thinkingLevel，Gemini 2.5 用 thinkingBudget）。`geminiToOpenaiRequest()` 新增 Gemini `thinkingConfig` → OpenAI `reasoning_effort` 提取。**

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts`
- `cloud-server/src/proxy/thinking.ts` — `extractGeminiThinking`, `mapLevelToBudget`

### 提供
- `openaiToGeminiRequest()` — OpenAI → Gemini 请求体转换
- `geminiToOpenaiResponse()` — Gemini 非流式响应 → OpenAI 格式
- `createGeminiStreamTransformer()` — Gemini SSE 流 → OpenAI SSE 流 TransformStream
- `geminiToOpenaiRequest()` — **v8** 反向：Gemini generateContent 请求 → OpenAI chat completions 格式
- `openaiToGeminiResponse()` — **v8** 反向：OpenAI chat completion 响应 → Gemini generateContent 格式
- `createOpenaiToGeminiStreamTransformer()` — **v8** 反向：OpenAI SSE 流 → Gemini SSE 流

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts`
