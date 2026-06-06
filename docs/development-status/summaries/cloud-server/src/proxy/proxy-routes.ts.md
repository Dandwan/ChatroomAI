# `cloud-server/src/proxy/proxy-routes.ts`

## 功能
定义面向客户端的代理路由。**v8: 提取 `forwardChatCompletion()` 共享转发核心，重构所有端点使用该核心。新增原生 Anthropic Messages API 端点（`POST /v1/messages`）、Gemini API 端点（`POST /v1beta/models/:model/:action`），以及 Anthropic/Gemini 格式模型列表。** `getRouting(apiType)` 查表模式支持 openai/anthropic/gemini 三种 API 类型，Gemini 新增 `geminiStreamMode` 参数支持 `:streamGenerateContent` 和 `?alt=sse` 两种流式方式。模型列表端点根据 `anthropic-version` 请求头自动切换 OpenAI/Anthropic 格式。**v10: 新增 `POST /v1/messages/count_tokens` 端点（上游优先，失败回退字符估算）；Anthropic 端点统一使用 Anthropic 格式错误响应；转发 Anthropic 协议头到上游。** **v11: `ForwardChatOptions` 新增 `clientApiType`；接入 `smart-router` 智能直通逻辑；`forwardChatCompletion` 在异格式转发前调用 `signatures.sanitizeRequestBodyMessages()` 清洗跨 provider 签名；新增 `POST /v1/responses` 端点（OpenAI Responses API）。接入 transformer-cache 追踪流式转换器配置。** **v12: Anthropic endpoint 从请求 body 提取工具名列表传入 `createOpenaiToAnthropicStreamTransformer`，作为 DeepSeek V4 Pro 不发送 `function.name` 时的 fallback。** **v13: `forwardChatCompletion()` 重试循环从扁平 `while(true)` + `triedKeyIds` 改为两级循环——外层按优先级组（`getPriorityGroups()`）遍历，内层持续重试当前组所有 healthy key 直到全部标记 unhealthy 才进入下一优先级。** **v14: 移除 Anthropic 协议头收集与转发（对齐 CPA）— `forwardChatCompletion()` 不再从客户端请求中提取 `anthropic-version`/`anthropic-beta`/`x-api-key` 作为 extraHeaders 传递给 `forwardNonStreamRequest()`。** **v15: 流式防重试加固 — `forwardChatCompletion()` 的 catch 块检查流式请求的 `STREAM_HEADERS_SENT` 错误码和 `res.headersSent`，一旦头已提交立即 throw 跳出重试循环。所有路由端点（OpenAI/Anthropic/Gemini/Responses）的流式错误响应路径新增 `!res.headersSent` 守卫。** **v16: outputTransformer 工厂化 — `ForwardChatOptions.outputTransformer` 从实例改为 factory 函数 `() => TransformStream`，每次重试调用工厂创建全新 TransformStream，修复 "WritableStream is locked" 错误。** **v17: 接入错误分类器（`error-classifier.ts`）— `markUnhealthy` 前调用 `shouldMarkUnhealthy()`，仅网络不可达/5xx/认证计费/429 才标记 key 不健康，400/422 等客户端错误不标记。新增两级断路器：`MAX_TOTAL_ATTEMPTS=30`（总尝试次数上限）、`MAX_CONSECUTIVE_4XX=3`（连续 4xx 提前终止，避免无意义地轮询所有 key）。新增 `consecutive4xx` 计数器追踪客户端错误。** **v18: 三级 per-key 容错解析 — 新增 `resolveFaultTolerance()` 辅助函数，按 key→upstream→global 优先级解析有效容错值，-1/null/undefined 回落下一级，0=零容忍；修复 catch 块硬编码 `statusCode: 502` — 改为从错误消息中提取上游真实状态码（正则匹配 `上游.*请求失败 (\d+)`），使错误分类器能正确区分 400（不标记）和 401/5xx（标记）。

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
- `cloud-server/src/proxy/error-classifier.ts` — `shouldMarkUnhealthy` **v17**
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
