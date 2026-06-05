# `cloud-server/src/proxy/rate-limiter.ts`

## 功能
基于用户的请求频率限制中间件。按用户 ID 维护每分钟和每日计数器，与数据库中的 `rate_limit_rpm`（每分钟限制）和 `rate_limit_tpd`（每日限制）对比。超过限制返回 429，同时在响应头中注入 `X-RateLimit-Limit-RPM/TPD` 和 `X-RateLimit-Remaining-RPM/TPD`。管理员创建的独立 API Key（`api_keys` 表）无对应用户记录时，跳过频率限制。定期清理过期计数器（每 5 分钟）。

## 关系
### 调用 / 引用
- `cloud-server/src/app-context.ts` — `AppContext`
- `cloud-server/src/logger.ts` — `createLogger`
- `express` — `Request`, `Response`, `NextFunction`

### 提供
- `createRateLimiter()` — 创建用户频率限制中间件工厂

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts`

## 关键词
### 函数
- `createRateLimiter`
- `getMinuteWindow`
- `getDayWindow`
