# `cloud-server/src/types.ts`

## 功能
Cloud server 共享类型定义。包含 `User`、`Upstream`、`ModelEntry`、`UpstreamApiKey`、`ModelPriority`、`UsageLog`、`HealthCheck` 等所有核心数据接口，以及 API 响应类型和插件系统接口。**v5: 健康机制从 per-upstream 改为 per-key。**`Upstream` 移除 `fault_tolerance`，新增 `key_fault_tolerance: number | null`（该上游下 Key 的默认容错值，为 null 时使用全局默认）。`UpstreamApiKey` 新增 `fault_tolerance: number`（每个 Key 独立的容错阈值，覆盖上游默认和全局默认）。

## 关系
### 提供
- `Upstream`
- `UpstreamApiKey`
- `UpstreamWithKeys`
- `ModelEntry`、`ModelPriority`
- `User`、`AdminUser`、`UsageLog`、`HealthCheck`
- API 响应类型和插件接口

### 被依赖
- `cloud-server/src/db/repositories/upstream-repo.ts`
- `cloud-server/src/proxy/model-strategy.ts`
- `cloud-server/src/proxy/upstream-selector.ts`
- `cloud-server/src/admin/admin-routes.ts`
- `cloud-server/admin-ui/src/api.ts`
