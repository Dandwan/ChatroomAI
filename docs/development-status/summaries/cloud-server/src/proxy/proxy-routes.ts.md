# `cloud-server/src/proxy/proxy-routes.ts`

## 功能
定义面向客户端的代理路由。`POST /v1/chat/completions` 端点会根据上游 API 类型（OpenAI / Anthropic）透明转换请求和响应格式：OpenAI 上游直接转发到 `/v1/chat/completions`，Anthropic 上游转换后转发到 `/v1/messages` 并将响应转回 OpenAI 格式。`GET /v1/models` 端点聚合所有启用上游的模型列表。

## 关系
### 调用 / 引用
- `cloud-server/src/proxy/upstream-selector.ts` — `selectUpstream`, `markUnhealthy`
- `cloud-server/src/proxy/model-strategy.ts` — `getAvailableModels`
- `cloud-server/src/proxy/request-forwarder.ts` — `forwardStreamRequest`, `forwardNonStreamRequest`
- `cloud-server/src/proxy/format-converter.ts` — 格式转换函数
- `cloud-server/src/auth/middleware.ts` — `createApiKeyAuth`
- `cloud-server/src/proxy/rate-limiter.ts` — `createRateLimiter`

### 提供
- `createProxyRoutes()` — 创建代理路由的 Express Router

### 被依赖
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `createProxyRoutes`
