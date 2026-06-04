# `cloud-server/admin-ui/src/api.ts`

## 功能
Admin UI API 客户端层。封装后端 `/api/admin/*` 端点的 HTTP 请求，自动 JWT token 注入和 401 重定向。定义前端类型和 CRUD 函数。**v5: `UpstreamData` 使用 `key_fault_tolerance`；`api_keys` 数组项新增 `fault_tolerance: number`；新增 `UpstreamKeyData` 接口；`createUpstream` 参数改为 `key_fault_tolerance`；新增 `updateUpstreamKey()` 函数。**

## 关系
### 提供
- `UpstreamData`、`UpstreamKeyData`、`ModelEntryData`、`ModelPriorityData`、`UserData` 等类型
- `fetchUpstreams`、`createUpstream`、`updateUpstream`、`deleteUpstream`
- `addUpstreamKey`、`updateUpstreamKey`、`deleteUpstreamKey`
- `fetchUpstreamModels`、`fetchModelPriorities`、`fetchUsage`、`fetchAvailability`
- Auth 和用户管理 API 函数

### 被依赖
- `cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`
- `cloud-server/admin-ui/src/pages/ModelPrioritiesPage.tsx`
- `cloud-server/admin-ui/src/pages/UsersPage.tsx`
- `cloud-server/admin-ui/src/pages/DashboardPage.tsx`
