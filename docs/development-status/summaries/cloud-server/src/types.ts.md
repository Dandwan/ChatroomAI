# `cloud-server/src/types.ts`

## 功能
Cloud server 共享类型定义。包含 `User`、`Upstream`、`ModelEntry`、`UpstreamApiKey`、`ModelPriority`、`UsageLog`、`HealthCheck` 等所有核心数据接口，以及 API 响应类型和插件系统接口。**v5: 健康机制从 per-upstream 改为 per-key。v7: 新增 `ApiType = 'openai' | 'anthropic' | 'gemini'` 联合类型，`Upstream.api_type` 和 `ModelEntry.api_type` 使用 `ApiType`。**

## 关系
### 提供
- `ApiType` — 上游 API 类型联合
- `Upstream`、`UpstreamApiKey`、`UpstreamWithKeys`
- `ModelEntry`、`ModelPriority`
- `User`、`AdminUser`、`UsageLog`、`HealthCheck`
- API 响应类型和插件接口

### 被依赖
- `cloud-server/src/db/repositories/upstream-repo.ts`
- `cloud-server/src/proxy/model-strategy.ts`
- `cloud-server/src/proxy/upstream-selector.ts`
- `cloud-server/src/proxy/proxy-routes.ts`
- `cloud-server/src/admin/admin-routes.ts`
- `cloud-server/admin-ui/src/api.ts`
