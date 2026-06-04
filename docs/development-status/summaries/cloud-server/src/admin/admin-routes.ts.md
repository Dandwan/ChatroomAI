# `cloud-server/src/admin/admin-routes.ts`

## 功能
管理后台 HTTP 路由。管理员登录（IP 速率限制）、使用统计查询、可用性统计、上游 CRUD、API Key CRUD 和用户管理。除登录外均受 JWT 管理员认证保护。**v5: POST/PUT 上游使用 `key_fault_tolerance`；POST/PUT Key 支持 `fault_tolerance`；新增 `PUT /:id/keys/:keyId` 端点更新 Key（含容错配置）。Key 创建时容错值继承链：请求参数 > upstream.key_fault_tolerance > 全局默认。**

## 关系
### 调用 / 引用
- `cloud-server/src/app-context.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/auth/auth-service.ts`
- `cloud-server/src/auth/ip-rate-limiter.ts`
- `cloud-server/src/proxy/proxy-agent.ts`
- `uuid`

### 提供
- `createAdminRoutes()` — Express Router

### 被依赖
- `cloud-server/src/app.ts`
