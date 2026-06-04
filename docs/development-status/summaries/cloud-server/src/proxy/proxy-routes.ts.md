# `cloud-server/src/proxy/proxy-routes.ts`

## 功能
定义面向客户端的代理路由。`POST /v1/chat/completions` 端点根据上游 API 类型透明转换请求/响应格式。**v6: 新增 `resolveFriendlyModel()` 辅助函数，在请求入口处将友好的 ActiNet 模型名（如"快速"）映射为实际上游模型名（如"gpt-4o-mini"）；映射后使用 `effectiveModel` 进行上游选择和转发，请求体中的 `model` 字段也随之替换；响应中保留原始友好名以维持客户端一致性。`GET /v1/models` 返回列表中合并了 `actiNetModelMapping` 的 key（友好名），确保客户端可发现。** **v5: 重试循环改为 per-key 追踪。** `triedKeyIds: Set<keyId>` 替代 `triedIds: Set<upstreamId>`，失败后标记该 Key 不健康并尝试同 upstream 的下一个健康 Key（同上游内轮转），全部 Key 失败后再跳到下一个 upstream。`failureTracker.recordFailure/recordSuccess` 参数改为 `keyId`；`fault_tolerance` 使用 `upstream.key_fault_tolerance ?? ctx.config.defaultFaultTolerance`。转发调用包裹在内部 try-catch 中，捕获错误后转换为 `{ statusCode: 502 }` 结果供重试循环处理。`GET /v1/models` 聚合所有启用 upstream 的模型列表。

## 关系
### 调用 / 引用
- `cloud-server/src/proxy/upstream-selector.ts`
- `cloud-server/src/proxy/model-strategy.ts` — `getAvailableModels`
- `cloud-server/src/proxy/request-forwarder.ts`
- `cloud-server/src/proxy/format-converter.ts`
- `cloud-server/src/proxy/failure-tracker.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/proxy/rate-limiter.ts`
- `cloud-server/src/config.ts` — `ServerConfig.actiNetModelMapping`（模型名映射）

### 提供
- `createProxyRoutes()` — Express Router

### 被依赖
- `cloud-server/src/app.ts`
