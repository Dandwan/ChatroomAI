# `cloud-server/src/proxy/proxy-routes.ts`

## 功能
定义面向客户端的代理路由。`POST /v1/chat/completions` 端点根据上游 API 类型透明转换请求/响应格式。**v7: 使用 `getRouting(apiType)` 查表模式替代 if/else 分支，支持 openai/anthropic/gemini 三种 API 类型。** 重试循环为 per-key 追踪。`GET /v1/models` 聚合所有启用 upstream 的模型列表。

## 关系
### 调用 / 引用
- `cloud-server/src/proxy/upstream-selector.ts`
- `cloud-server/src/proxy/model-strategy.ts` — `getAvailableModels`
- `cloud-server/src/proxy/request-forwarder.ts`
- `cloud-server/src/proxy/format-converter.ts`
- `cloud-server/src/proxy/format-gemini.ts`
- `cloud-server/src/proxy/failure-tracker.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/proxy/rate-limiter.ts`
- `cloud-server/src/types.ts` — `ApiType`

### 提供
- `createProxyRoutes()` — Express Router

### 被依赖
- `cloud-server/src/app.ts`
