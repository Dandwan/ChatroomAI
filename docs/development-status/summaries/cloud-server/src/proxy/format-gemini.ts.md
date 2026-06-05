# `cloud-server/src/proxy/format-gemini.ts`

## 功能
OpenAI ↔ Gemini (Google Generative Language API) 格式转换模块。提供请求体转换（OpenAI → Gemini）、非流式响应转换（Gemini → OpenAI）和 SSE 流式事件转换（Gemini SSE → OpenAI SSE）。支持系统消息→systemInstruction、多模态图片 inlineData、finishReason 映射和 usageMetadata token 统计。

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts`

### 提供
- `openaiToGeminiRequest()` — OpenAI → Gemini 请求体转换
- `geminiToOpenaiResponse()` — Gemini 非流式响应 → OpenAI 格式
- `createGeminiStreamTransformer()` — Gemini SSE 流 → OpenAI SSE 流 TransformStream

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts`
