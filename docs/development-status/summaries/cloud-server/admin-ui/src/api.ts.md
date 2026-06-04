# `cloud-server/admin-ui/src/api.ts`

## 功能
Admin UI 的 API 客户端层。封装所有后端 `/api/admin/*` 端点的 HTTP 请求，含自动 JWT token 注入和 401 重定向。定义 `UpstreamData`（含 `api_type`、`ModelEntryData[]`）、`ModelPriorityData`、`UserData` 等前端类型及对应的 CRUD 函数。新增 `fetchUpstreamModels()` 函数用于从上游拉取模型列表。

## 关系
### 调用 / 引用
- (无内部依赖，仅使用 `fetch`)

### 提供
- `UpstreamData`、`ModelEntryData` — 上游数据接口
- `fetchUpstreams()`、`createUpstream()`、`updateUpstream()`、`deleteUpstream()` — 上游 CRUD
- `fetchUpstreamModels()` — 从上游获取模型列表
- `fetchModelPriorities()`、`createModelPriority()` 等 — 模型优先级 CRUD
- `fetchUsers()`、`updateUser()`、`deleteUser()` — 用户管理
- `fetchUsage()`、`fetchAvailability()` — 统计数据

### 被依赖
- `cloud-server/admin-ui/src/pages/*` — 各页面调用 API 函数
