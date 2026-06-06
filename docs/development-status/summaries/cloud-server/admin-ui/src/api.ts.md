# `cloud-server/admin-ui/src/api.ts`

## 功能
Admin UI API 客户端层。封装后端 `/api/admin/*` 端点的 HTTP 请求，自动 JWT token 注入和 401 重定向。定义前端类型和 CRUD 函数。**v6: `ServerSettings` 新增 `actiNetModelMapping: Record<string, string>`；`updateSettings()` 参数新增 `actiNetModelMapping?`。** **v5: 新增 `ServerSettings` 接口、`fetchSettings()`、`updateSettings()`；`UpstreamData` 使用 `key_fault_tolerance`；`api_keys` 数组项和 `UpstreamKeyData` 不再包含 `fault_tolerance` 字段；新增 `UpstreamKeyData` 接口和 `updateUpstreamKey()`（不接受 `fault_tolerance`）；`createUpstream`、`addUpstreamKey` 参数也不再接受 `fault_tolerance`。** **v11: 新增邮件相关 — `SmtpSettings` 接口、`TestEmailResult` 接口、`EmailSendRecord` 接口、`EmailStatus` 接口、`sendTestEmail(to)`、`fetchEmailStatus()`。v12: 新增 `AdminApiKeyData` 接口和 `fetchApiKeys/createApiKey/updateApiKey/deleteApiKey` 函数。v13: `ServerSettings` 和 `updateSettings()` 新增 `emailCooldownSeconds: number`。**

## 关系
### 提供
- `UpstreamData`、`UpstreamKeyData`、`ModelEntryData`、`ModelPriorityData`、`UserData`、`ServerSettings` 等类型
- `SmtpSettings`、`TestEmailResult`、`EmailSendRecord`、`EmailStatus` — 邮件相关类型
- `fetchUpstreams`、`createUpstream`、`updateUpstream`、`deleteUpstream`
- `addUpstreamKey`、`updateUpstreamKey`、`deleteUpstreamKey`
- `fetchUpstreamModels`、`fetchModelPriorities`、`fetchUsage`、`fetchAvailability`
- `fetchSettings`、`updateSettings`
- `sendTestEmail`、`fetchEmailStatus` — 邮件测试与状态查询
- `fetchApiKeys`、`createApiKey`、`updateApiKey`、`deleteApiKey` — 管理员 API 密钥管理
- `updateKeyHealth`、`batchUpdateKeyHealth` — Key 健康标记（单个/批量）
- Auth 和用户管理 API 函数

### 被依赖
- `cloud-server/admin-ui/src/pages/SettingsPage.tsx`
- `cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`
- `cloud-server/admin-ui/src/pages/ModelPrioritiesPage.tsx`
- `cloud-server/admin-ui/src/pages/UsersPage.tsx`
- `cloud-server/admin-ui/src/pages/DashboardPage.tsx`
- `cloud-server/admin-ui/src/pages/ApiKeysPage.tsx`
- `cloud-server/admin-ui/src/pages/HealthPage.tsx`
