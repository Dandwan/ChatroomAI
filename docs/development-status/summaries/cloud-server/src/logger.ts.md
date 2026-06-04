# `cloud-server/src/logger.ts`

## 功能
Cloud server 的统一日志模块。提供分级（debug/info/warn/error）、带 ISO 时间戳、组件标签化的日志输出。利用 `config.ts` 中已有的 `logLevel` 配置项进行级别过滤，零外部依赖。内置敏感信息脱敏功能（`redactObject`/`redactValue`）。

## 关系
### 提供
- `createLogger(component)` — 创建带组件标签的 Logger 实例
- `initLogger(level)` — 在启动时注入全局日志级别
- `getLogLevel()` — 获取当前级别
- `redactValue(s)` — 单字符串脱敏
- `redactObject(obj)` — 递归脱敏对象中的敏感字段

### 被依赖
- 所有 cloud-server 模块（通过 `createLogger()` 获取实例）

## 关键词
### 函数
- `createLogger`
- `initLogger`
- `getLogLevel`
- `redactValue`
- `redactObject`
- `formatMessage`
- `safeStringify`
- `errorToMeta`

### 接口
- `Logger`
- `LogLevel`
