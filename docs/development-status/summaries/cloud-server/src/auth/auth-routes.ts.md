# `cloud-server/src/auth/auth-routes.ts`

## 功能
定义用户认证相关的 HTTP 路由。提供用户注册（`POST /api/auth/register` — 注册后需输入邮件中的 6 位验证码，不再自动登录，**冷却阻塞时返回等待提示**，**重新注册同一未验证邮箱时返回覆盖提示**）、登录（`POST /api/auth/login` — 拒绝未验证邮箱的用户）、当前用户信息查询（`GET /api/auth/me` — 含 `email_verified` 字段）、邮箱验证（`POST /api/auth/verify-email` — 接受 `{ token }`，6 位数字验证码）、重发验证邮件（`POST /api/auth/resend-verification` — 安全模糊响应，不暴露冷却状态）、**密码重置请求（`POST /api/auth/forgot-password` — 1次/5分钟/IP 限流，安全模糊响应）**、**密码重置执行（`POST /api/auth/reset-password` — 5次/10分钟/IP 限流）**、**邮箱更换请求（`POST /api/auth/change-email` — API Key 认证，冷却时返回 429 COOLDOWN）**、**邮箱更换确认（`POST /api/auth/confirm-email-change`）**。注册和登录端点受 IP 级速率限制保护，`/me`、`/change-email` 端点受 API Key 认证中间件保护。

## 关系
### 调用 / 引用
- `cloud-server/src/auth/auth-service.ts` — `loginUser`, `createUser`, `verifyEmail`, `resendVerificationEmail`, `requestPasswordReset`, `resetPassword`, `requestEmailChange`, `confirmEmailChange`
- `cloud-server/src/auth/middleware.ts` — `createApiKeyAuth`
- `cloud-server/src/auth/ip-rate-limiter.ts` — `createLoginRateLimiter`, `createRegisterRateLimiter`, `createIpRateLimiter`
- `cloud-server/src/logger.ts` — `createLogger`
- `express` — `Router`

### 提供
- `createAuthRoutes()` — 创建并返回认证路由的 Express Router

### 被依赖
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `createAuthRoutes`
- `createForgotPasswordLimiter`
- `createResetPasswordLimiter`
- `createResendVerificationLimiter`
