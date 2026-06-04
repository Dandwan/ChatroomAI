# `cloud-server/src/upstream/health-checker.ts`

## 功能
**per-key 健康检查模块。** 启动后每 `healthCheckIntervalMs`（默认 10 分钟）周期性遍历所有 unhealthy key 并逐个执行健康探测。`markUnhealthy(keyId)` 触发即时异步检测（通过 `setKeyCheckHandler` 注册的回调，`setTimeout(0)` 去重调度）。检测逻辑向 `/v1/models` 发送 GET 请求，接受 200/401。恢复 → `markHealthy(keyId)`；仍不可达 → `markUnhealthy(keyId)`（重新触发即时检测）。结果写入 `health_checks` 表，定期清理 7 天前旧记录。

## 关系
### 调用 / 引用
- `cloud-server/src/app-context.ts`
- `cloud-server/src/types.ts`
- `cloud-server/src/proxy/upstream-selector.ts` — `markHealthy`、`markUnhealthy`、`getUnhealthyKeys`、`setKeyCheckHandler`
- `cloud-server/src/proxy/proxy-agent.ts` — `getProxyDispatcher`、`buildUpstreamUrl`
- `cloud-server/src/logger.ts`

### 提供
- `startHealthChecker()` — 启动健康检查循环

### 被依赖
- `cloud-server/src/app.ts`
