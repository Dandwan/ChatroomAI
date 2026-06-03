# `cloud-server/src/auth/auth-routes.ts`

## 功能
定义用户认证相关的 HTTP 路由。提供用户注册（`POST /api/auth/register`）、登录（`POST /api/auth/login`）和当前用户信息查询（`GET /api/auth/me`）。注册和登录端点受 IP 级速率限制保护，`/me` 端点受 API Key 认证中间件保护。

## 关系
### 调用 / 引用
- `cloud-server/src/auth/auth-service.ts` — `loginUser`, `createUser`, `generateJwtToken`
- `cloud-server/src/auth/middleware.ts` — `createApiKeyAuth`
- `cloud-server/src/auth/ip-rate-limiter.ts` — `createLoginRateLimiter`, `createRegisterRateLimiter`
- `express` — `Router`

### 提供
- `createAuthRoutes()` — 创建并返回认证路由的 Express Router

### 被依赖
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `createAuthRoutes`
