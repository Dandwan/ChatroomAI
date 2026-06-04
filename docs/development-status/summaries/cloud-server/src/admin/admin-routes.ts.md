# `cloud-server/src/admin/admin-routes.ts`

## 功能
管理后台 HTTP 路由。管理员登录（IP 速率限制）、使用统计查询、可用性统计、上游 CRUD、API Key CRUD、模型优先级管理、用户管理和**全局设置**。除登录外均受 JWT 管理员认证保护。

**v5 Key 容错继承链：** Key 创建端点不再接受 `fault_tolerance` 参数。Key 的容错值从上游 `key_fault_tolerance` 继承，若为 null 则回退到全局 `defaultFaultTolerance`。

**v5 全局设置端点：**
- `GET /api/admin/settings` — 返回 `defaultFaultTolerance`、`healthCheckIntervalMs`、`port`、`logLevel`
- `PUT /api/admin/settings` — 更新 `defaultFaultTolerance`（即时生效 + 持久化到 `config.json`）

**v6 全局设置更新：** GET/PUT `/api/admin/settings` 新增 `actiNetModelMapping` 字段（`Record<string, string>`），支持 null 清空映射、值类型校验，持久化到 `config.json`。

## 关系
### 调用 / 引用
- `cloud-server/src/app-context.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/auth/auth-service.ts`
- `cloud-server/src/auth/ip-rate-limiter.ts`
- `cloud-server/src/proxy/proxy-agent.ts`
- `node:fs`、`node:path`、`node:url`、`uuid`

### 提供
- `createAdminRoutes()` — Express Router

### 被依赖
- `cloud-server/src/app.ts`
