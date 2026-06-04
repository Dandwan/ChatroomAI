# `cloud-server/src/app.ts`

## 功能
创建并配置 Express 应用实例。负责数据库初始化、应用上下文创建、管理员种子用户创建、健康检查启动、全局中间件注册（CORS、JSON 解析、请求日志）、路由挂载（代理路由、认证路由、管理路由）、管理后台静态文件服务以及全局错误处理中间件。

## 关系
### 调用 / 引用
- `express` — 框架主入口（`cors`、`express.json`）
- `cloud-server/src/config.ts` — `ServerConfig`
- `cloud-server/src/db/database.ts` — `getDatabase`
- `cloud-server/src/middleware/request-logger.ts` — `requestLogger`
- `cloud-server/src/middleware/error-handler.ts` — `errorHandler`
- `cloud-server/src/app-context.ts` — `createAppContext`, `AppContext`
- `cloud-server/src/auth/auth-service.ts` — `seedAdminUser`
- `cloud-server/src/auth/auth-routes.ts` — `createAuthRoutes`
- `cloud-server/src/proxy/proxy-routes.ts` — `createProxyRoutes`
- `cloud-server/src/admin/admin-routes.ts` — `createAdminRoutes`
- `cloud-server/src/upstream/health-checker.ts` — `startHealthChecker`
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `createApp()` — 创建并返回 Express 应用和 AppContext

### 被依赖
- `cloud-server/src/index.ts`

## 关键词
### 函数
- `createApp`
