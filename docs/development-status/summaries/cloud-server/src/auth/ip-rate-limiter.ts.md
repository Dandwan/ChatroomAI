# `cloud-server/src/auth/ip-rate-limiter.ts`

## 功能
提供基于 IP 地址的轻量级速率限制中间件。与基于用户的 `rate-limiter.ts` 互补，专门用于认证端点（登录、注册）的防暴力破解保护。支持自定义时间窗口和最大请求数，自动清理过期计数器。

## 关系
### 提供
- `createIpRateLimiter()` — 通用 IP 限流中间件工厂函数，接受规则、错误码和错误消息
- `createLoginRateLimiter()` — 预配置的登录限流器（5 次/分钟/IP）
- `createRegisterRateLimiter()` — 预配置的注册限流器（3 次/小时/IP）

### 被依赖
- `cloud-server/src/auth/auth-routes.ts`
- `cloud-server/src/admin/admin-routes.ts`

## 关键词
### 函数
- `createIpRateLimiter`
- `createLoginRateLimiter`
- `createRegisterRateLimiter`
- `getClientIp`
