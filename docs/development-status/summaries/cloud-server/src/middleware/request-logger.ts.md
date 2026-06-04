# `cloud-server/src/middleware/request-logger.ts`

## 功能
HTTP 请求日志中间件。在请求进入时以 debug 级别记录请求方法、路径和请求体（截断至 2048 字符）；在响应结束时以 info/warn/error 级别记录状态码、耗时、用户 ID 和脱敏后的认证头。状态码 >= 500 以 error 输出，>= 400 以 warn 输出。

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`, `redactValue`
- `express` — `Request`, `Response`, `NextFunction`

### 提供
- `requestLogger()` — Express 中间件函数

### 被依赖
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `requestLogger`

### 常量
- `MAX_BODY_LOG_LENGTH`
