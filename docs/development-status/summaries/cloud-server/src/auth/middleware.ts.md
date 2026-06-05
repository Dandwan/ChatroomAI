# `cloud-server/src/auth/middleware.ts`

## 功能
提供 Express 认证中间件。`createApiKeyAuth` 通过 Bearer token（API Key）先查 `users` 表，再查 `api_keys` 表（管理员创建的独立 API 密钥），`createAdminAuth` 通过 JWT 认证管理员请求。同时扩展 Express 的 `Request` 类型以附加 `userId` 和 `userApiKey` 字段。

## 关系
### 调用 / 引用
- `cloud-server/src/auth/auth-service.ts` — `verifyJwtToken`
- `cloud-server/src/db/repositories/api-key-repo.ts` — `findByApiKey`, `markUsed`
- `cloud-server/src/logger.ts` — `createLogger`, `redactValue`
- `express` — `Request`, `Response`, `NextFunction`

### 提供
- `createApiKeyAuth()` — API Key 认证中间件工厂
- `createAdminAuth()` — JWT 管理员认证中间件工厂

### 被依赖
- `cloud-server/src/auth/auth-routes.ts`
- `cloud-server/src/admin/admin-routes.ts`
- `cloud-server/src/proxy/proxy-routes.ts`
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `createAdminAuth`
- `createApiKeyAuth`
- `extractToken`
