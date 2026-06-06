# `tools/proxy-diff/src/logger.ts`

## 功能
轻量级日志模块。提供 `createLogger(module)` 工厂函数，返回带 `[module]` 前缀的 debug/info/warn/error 方法。

## 关系
### 提供
- `Logger` 接口
- `createLogger()` 工厂函数

### 被依赖
- `upstream-simulator.ts`
- `request-dispatcher.ts`
- `proxy-forwarder.ts`
- `recorder.ts`
- `comparator.ts`
- `index.ts`
