# `cloud-server/src/index.ts`

## 功能
Cloud server 入口文件。负责加载配置、初始化全局日志级别、创建 Express 应用并启动 HTTP 服务器，同时注册全局异常捕获（`uncaughtException`、`unhandledRejection`）和优雅关闭（SIGINT/SIGTERM 信号处理）。

## 关系
### 调用 / 引用
- `cloud-server/src/config.ts` — `loadConfig`
- `cloud-server/src/app.ts` — `createApp`
- `cloud-server/src/db/database.ts` — `closeDatabase`
- `cloud-server/src/logger.ts` — `initLogger`, `createLogger`

### 提供
- `main()` — 异步启动入口（IIFE 执行，不导出）

### 被依赖
- （无，入口文件不被其他模块依赖）

## 关键词
### 函数
- `main`
- `shutdown`
