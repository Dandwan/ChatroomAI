# `cloud-server/src/upstream/health-checker.ts`

## 功能
上游服务健康检查模块。启动后每 `healthCheckIntervalMs`（默认 10 分钟）周期性地对所有被标记为不健康的上游执行健康探测（向 `/v1/models` 发送 GET 请求），接受 200 和 401 作为可达状态。发现恢复则调用 `markHealthy()` 重新启用，仍不可达则保持 `markUnhealthy()`。同时将检查结果写入 `health_checks` 表并定期清理 7 天前的旧记录。

## 关系
### 调用 / 引用
- `cloud-server/src/app-context.ts` — `AppContext`
- `cloud-server/src/types.ts` — `UpstreamWithKeys`
- `cloud-server/src/proxy/upstream-selector.ts` — `markHealthy`, `markUnhealthy`, `isUpstreamHealthy`
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `startHealthChecker()` — 启动健康检查循环

### 被依赖
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `startHealthChecker`
- `checkUpstream`
