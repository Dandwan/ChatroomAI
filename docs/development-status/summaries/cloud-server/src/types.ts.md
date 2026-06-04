# `cloud-server/src/types.ts`

## 功能
Cloud server 共享类型定义。包含 `User`、`Upstream`（含 `api_type` 和 `ModelEntry[]` models）、`ModelEntry`（模型条目，含可选的 per-model API 类型覆盖）、`UpstreamApiKey`、`ModelPriority`、`UsageLog`、`HealthCheck` 等所有核心数据接口，以及 API 响应类型和插件系统接口。

## 关系
### 提供
- `ModelEntry` — 模型条目接口（`name`, `api_type?`）
- `Upstream` — 上游配置接口（含 `api_type: 'openai' | 'anthropic'` 和 `models: ModelEntry[]`）
- `ModelPriority` — 模型优先级接口
- `UpstreamWithKeys` — 上游+API Key 组合接口
- `User`、`AdminUser`、`UsageLog`、`HealthCheck` 等多种数据接口
- 插件系统类型

### 被依赖
- `cloud-server/src/db/repositories/*` — 数据访问
- `cloud-server/src/proxy/*` — 代理和策略
- `cloud-server/src/admin/admin-routes.ts` — 管理 API
- `cloud-server/src/auth/*` — 认证
