# `cloud-server/src/admin/admin-routes.ts`

## 功能
管理后台 HTTP 路由。管理员登录（IP 速率限制）、使用统计查询、可用性统计、上游 CRUD、API Key CRUD、模型优先级管理、用户管理和全局设置（含 `pendingAccountRetentionHours`，1-720 整数验证）。除登录外均受 JWT 管理员认证保护。全局设置持久化到 `data/config.json`（Docker volume）。**v15: POST upstreams 和 POST keys 端点支持 per-key `fault_tolerance` 参数（-1=使用默认值）。v16: GET/PUT /settings 新增 `upstreamTimeoutMs`（>=1000）、`port`（1-65535）、`logLevel`（debug/info/warn/error）、`healthCheckIntervalMs`（>=1000）字段。**

**v7 新增端点：**
- `GET /api/admin/logs` — 分页日志查询（支持状态/用户/上游/时间筛选）
- `GET /api/admin/logs/stream` — SSE 实时日志流（2s 间隔推送）
- `GET /api/admin/stats/usage/detail` — 按 user/model/upstream 分组统计
- `GET /api/admin/stats/server` — 服务器指标（运行时间、内存、WS 连接、请求数）
- `GET /api/admin/health/keys` — 所有 Key 健康状态

**v14 健康标记端点：**
- `PUT /api/admin/health/keys/:keyId` — 手动设置单个 Key 健康状态（`{ healthy: boolean }`）
- `POST /api/admin/health/keys/batch` — 批量设置 Key 健康状态（`{ keyIds: string[], healthy: boolean }`）

**v7 全局设置更新：** GET/PUT `/api/admin/settings` 新增 `proxyUrl`、`wsAuth`、`tlsEnable`/`tlsCert`/`tlsKey` 字段。**v13: 新增 `emailCooldownSeconds` 字段（非负整数，默认 120），支持 GET/PUT 和 config.json 持久化。**

**v11 邮件端点：**
- `POST /api/admin/email/test` — 发送测试邮件验证 SMTP 配置（`sendTestEmail`）
- `GET /api/admin/email/status` — SMTP 状态（已配置、主机、发件人、最近 20 条发送记录）

**v12 API Key 端点：**
- `GET /api/admin/api-keys` — 列出所有管理员创建的 API 密钥
- `POST /api/admin/api-keys` — 创建新 API 密钥（`{ name, api_key }`）
- `PUT /api/admin/api-keys/:id` — 更新名称/启用状态
- `DELETE /api/admin/api-keys/:id` — 删除密钥

## 关系
### 调用 / 引用
- `cloud-server/src/app-context.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/auth/auth-service.ts`
- `cloud-server/src/auth/ip-rate-limiter.ts`
- `cloud-server/src/proxy/proxy-agent.ts`
- `cloud-server/src/proxy/model-strategy.ts` — `getUnhealthyKeys`, `markHealthy`, `markUnhealthy`（动态导入）
- `cloud-server/src/email/email-service.ts` — `sendTestEmail`, `getSendHistory`
- `node:fs`、`node:path`、`node:url`、`uuid`

### 提供
- `createAdminRoutes()` — Express Router

### 被依赖
- `cloud-server/src/app.ts`
