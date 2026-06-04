# `cloud-server/src/proxy/proxy-routes.ts`

## 功能
定义面向客户端的代理路由。`POST /v1/chat/completions` 端点根据上游 API 类型透明转换请求/响应格式。**v5: 重试循环改为 per-key 追踪。** `triedKeyIds: Set<keyId>` 替代 `triedIds: Set<upstreamId>`，失败后标记该 Key 不健康并尝试同 upstream 的下一个健康 Key（同上游内轮转），全部 Key 失败后再跳到下一个 upstream。`failureTracker.recordFailure/recordSuccess` 参数改为 `keyId`，`fault_tolerance` 使用 `selected.apiKey.fault_tolerance`。`GET /v1/models` 聚合所有启用 upstream 的模型列表。

## 关系
### 调用 / 引用
- `cloud-server/src/proxy/upstream-selector.ts`
- `cloud-server/src/proxy/model-strategy.ts` — `getAvailableModels`
- `cloud-server/src/proxy/request-forwarder.ts`
- `cloud-server/src/proxy/format-converter.ts`
- `cloud-server/src/proxy/failure-tracker.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/proxy/rate-limiter.ts`

### 提供
- `createProxyRoutes()` — Express Router

### 被依赖
- `cloud-server/src/app.ts`
