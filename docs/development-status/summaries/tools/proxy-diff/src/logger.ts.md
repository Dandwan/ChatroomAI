## 功能

轻量级模块化日志封装。为每个模块创建带前缀的日志记录器，支持 debug/info/warn/error 四个级别。

## 关系

### 提供

- `createLogger(module)` — 创建带 `[module]` 前缀的日志记录器

### 被依赖

- `upstream-simulator.ts`
- `request-dispatcher.ts`
- `proxy-forwarder.ts`
- `recorder.ts`
- `comparator.ts`
- `index.ts`

## 关键词

### 函数

- `createLogger(module: string): Logger`
