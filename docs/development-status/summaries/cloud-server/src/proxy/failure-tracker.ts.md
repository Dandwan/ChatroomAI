# `cloud-server/src/proxy/failure-tracker.ts`

## 功能
内存中的 **API Key 级别** 连续失败追踪器。每次请求失败时递增计数器，成功时重置。当连续失败次数超过该 Key 配置的 `fault_tolerance` 阈值时返回 `true` 通知调用方应标记该 Key 为不健康。**v5: 参数从 `upstreamId` 改为 `keyId`（per-key 健康机制）。**

## 关系
### 提供
- `failureTracker` — `FailureTracker` 单例实例
- `FailureTracker.recordFailure(keyId, tolerance)` — 记录失败，返回是否应标记 unhealthy
- `FailureTracker.recordSuccess(keyId)` — 成功请求后重置计数器
- `FailureTracker.getFailures(keyId)` — 获取当前连续失败次数
- `FailureTracker.reset(keyId)` — 清除 Key 的所有计数器

### 被依赖
- `cloud-server/src/proxy/model-strategy.ts` — `markHealthy` 中调用 `reset`
- `cloud-server/src/proxy/proxy-routes.ts` — 请求成功/失败时记录
