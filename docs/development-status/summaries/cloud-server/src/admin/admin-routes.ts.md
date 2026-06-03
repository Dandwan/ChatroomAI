# `cloud-server/src/admin/admin-routes.ts`

## 功能
定义管理后台的所有 HTTP 路由。包括管理员登录（受 IP 速率限制保护）、使用统计查询（总体/按小时/按上游）、可用性统计查询、上游管理 CRUD（含 API Key 管理）和用户管理（查看/编辑限速参数/删除）。除登录外所有路由均受 JWT 管理员认证中间件保护。

## 关系
### 调用 / 引用
- `cloud-server/src/auth/middleware.ts` — `createAdminAuth`
- `cloud-server/src/auth/auth-service.ts` — `verifyPassword`, `generateJwtToken`
- `cloud-server/src/auth/ip-rate-limiter.ts` — `createLoginRateLimiter`
- `uuid` — `v4`

### 提供
- `createAdminRoutes()` — 创建并返回管理路由的 Express Router

### 被依赖
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `createAdminRoutes`
