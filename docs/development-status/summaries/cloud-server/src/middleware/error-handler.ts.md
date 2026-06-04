# `cloud-server/src/middleware/error-handler.ts`

## 功能
全局错误处理中间件。区分业务错误（`AppError`）和未预期异常：`AppError` 根据状态码 >= 500 选择 error/warn 级别，不打印堆栈；未预期异常打印完整 Error 对象（含堆栈）。统一返回 `{ error: { code, message } }` 格式的 JSON 响应。

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`
- `express` — `Request`, `Response`, `NextFunction`

### 提供
- `errorHandler()` — Express 错误处理中间件（4 参数签名）
- `AppError` — 自定义业务错误类（`statusCode` + `code`）

### 被依赖
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `errorHandler`

### 类
- `AppError`
