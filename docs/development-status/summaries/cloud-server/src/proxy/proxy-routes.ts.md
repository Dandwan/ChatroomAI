# `cloud-server/src/proxy/proxy-routes.ts`

## 功能
定义面向客户端的代理路由。**v8: 提取 `forwardChatCompletion()` 共享转发核心，重构所有端点使用该核心。新增原生 Anthropic Messages API 端点（`POST /v1/messages`）、Gemini API 端点（`POST /v1beta/models/:model/:action`），以及 Anthropic/Gemini 格式模型列表。** `getRouting(apiType)` 查表模式支持 openai/anthropic/gemini 三种 API 类型，Gemini 新增 `geminiStreamMode` 参数支持 `:streamGenerateContent` 和 `?alt=sse` 两种流式方式。模型列表端点根据 `anthropic-version` 请求头自动切换 OpenAI/Anthropic 格式。**v10: 新增 `POST /v1/messages/count_tokens` 端点（上游优先，失败回退字符估算）；Anthropic 端点统一使用 Anthropic 格式错误响应；转发 Anthropic 协议头到上游。** **v11: `ForwardChatOptions` 新增 `clientApiType`；接入 `smart-router` 智能直通逻辑；`forwardChatCompletion` 在异格式转发前调用 `signatures.sanitizeRequestBodyMessages()` 清洗跨 provider 签名；新增 `POST /v1/responses` 端点（OpenAI Responses API）。接入 transformer-cache 追踪流式转换器配置。** **v12: Anthropic endpoint 从请求 body 提取工具名列表传入 `createOpenaiToAnthropicStreamTransformer`，作为 DeepSeek V4 Pro 不发送 `function.name` 时的 fallback。** **v13: `forwardChatCompletion()` 重试循环从扁平 `while(true)` + `triedKeyIds` 改为两级循环——外层按优先级组（`getPriorityGroups()`）遍历，内层持续重试当前组所有 healthy key 直到全部标记 unhealthy 才进入下一优先级。**

## 关系
### 调用 / 引用
- `cloud-server/src/proxy/upstream-selector.ts` — `markUnhealthy`
- `cloud-server/src/proxy/model-strategy.ts` — `getAvailableModels`, `getPriorityGroups`, `isKeyHealthy` **v13**
- `cloud-server/src/proxy/distribution.ts` — `selectKey` **v13**
- `cloud-server/src/proxy/request-forwarder.ts`
- `cloud-server/src/proxy/format-converter.ts` — 全部 6 个转换函数
- `cloud-server/src/proxy/format-gemini.ts` — 全部 6 个转换函数
- `cloud-server/src/proxy/smart-router.ts` — `createRoutingPlan`
- `cloud-server/src/proxy/signatures.ts` — `sanitizeRequestBodyMessages`
- `cloud-server/src/proxy/responses-api.ts` — `responsesToChatCompletionsRequest`, `chatCompletionsToResponsesResponse`, `createResponsesStreamTransformer`
- `cloud-server/src/proxy/transformer-cache.ts` — `getTransformerKey`, `touchTransformerKey`
- `cloud-server/src/proxy/failure-tracker.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/proxy/rate-limiter.ts`
- `cloud-server/src/types.ts` — `ApiType`

### 提供
- `createProxyRoutes()` — Express Router（OpenAI + Anthropic 端点 + count_tokens，挂载于 `/v1`）
- `createGeminiRoutes()` — **v8** Express Router（Gemini 端点，挂载于 `/v1beta`）
- `forwardChatCompletion()` — **v8** 共享转发核心（内部使用，含 Anthropic 协议头转发）

### 被依赖
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `createProxyRoutes`
- `createGeminiRoutes`
- `forwardChatCompletion`
- `getRouting`
- `resolveFriendlyModel`
### 接口
- `ApiTypeRouting`
- `ForwardChatOptions`
- `ForwardChatResult`
