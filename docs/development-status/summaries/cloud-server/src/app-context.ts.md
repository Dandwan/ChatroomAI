# `cloud-server/src/app-context.ts`

## 功能
Cloud server 应用上下文。定义 `AppContext` 接口（含 `config`、`db`、`repos`、`updateConfig`、`wsManager`）和 `createAppContext()` 工厂函数，初始化所有 Repository 实例并注入运行时配置。

## 关系
### 调用 / 引用
- `cloud-server/src/config.ts` — `ServerConfig`
- `cloud-server/src/db/database.ts` — `SqlJsDatabase`
- `cloud-server/src/db/repositories/user-repo.ts` — `UserRepo`
- `cloud-server/src/db/repositories/upstream-repo.ts` — `UpstreamRepo`
- `cloud-server/src/db/repositories/usage-repo.ts` — `UsageRepo`
- `cloud-server/src/db/repositories/health-check-repo.ts` — `HealthCheckRepo`
- `cloud-server/src/db/repositories/model-priority-repo.ts` — `ModelPriorityRepo`
- `cloud-server/src/db/repositories/api-key-repo.ts` — `ApiKeyRepo`
- `cloud-server/src/ws/ws-manager.ts` — `WsManager`

### 提供
- `AppContext` — 应用上下文接口
- `createAppContext()` — 工厂函数

### 被依赖
- `cloud-server/src/app.ts`
- `cloud-server/src/index.ts`
- 所有模块通过 `AppContext` 获取 DB 和 Repository
