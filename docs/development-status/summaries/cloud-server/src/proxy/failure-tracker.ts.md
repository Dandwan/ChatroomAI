# `cloud-server/src/proxy/failure-tracker.ts`

## 功能
内存中的上游连续失败追踪器。每次请求失败时递增计数器，成功时重置。当连续失败次数超过上游配置的 `fault_tolerance` 阈值时，返回 `true` 通知调用方应标记该上游为不健康。

## 关系
### 提供
- `failureTracker` — `FailureTracker` 单例实例
- `FailureTracker.recordFailure(upstreamId, tolerance)` — 记录失败，返回是否应标记 unhealthy
- `FailureTracker.recordSuccess(upstreamId)` — 成功请求后重置计数器
- `FailureTracker.getFailures(upstreamId)` — 获取当前连续失败次数
- `FailureTracker.reset(upstreamId)` — 清除上游的所有计数器（恢复健康时使用）

### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`
