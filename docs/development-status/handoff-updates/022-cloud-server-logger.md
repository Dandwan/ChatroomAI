# 022 — Cloud Server 完整日志系统

**日期**：2026-06-04

## 范围

为 cloud-server（ActiNet 服务端）创建统一的日志模块，替换所有原始 `console.log`/`console.error` 调用，并为关键操作补充缺失的日志。利用 `config.ts` 中已存在但从未使用的 `logLevel` 配置项实现分级输出。

## 变更的代码区域

### 新建：`cloud-server/src/logger.ts`
- 核心日志模块（零外部依赖）
- 导出 `createLogger(component: string): Logger` — 工厂函数，生成带组件标签的 Logger 实例
- 导出 `initLogger(level: LogLevel)` — 启动时注入全局日志级别
- `Logger` 提供 `debug()` / `info()` / `warn()` / `error()` 四个级别方法
- `error()` 第二参数支持 `Error` 实例（自动展开 `name`/`message`/`stack`）
- 输出格式：`<ISO时间戳> <LEVEL5> [<组件>] <消息> <JSON附加数据>`
- `debug`/`info`/`warn` → stdout，`error` → stderr
- 内置 `redactObject()` / `redactValue()` 用于敏感信息脱敏（password/api_key/token/secret 等）

### 修改文件（21 个）：

| 模块 | 文件 | 主要改动 |
|------|------|---------|
| 配置/入口 | `config.ts` | 替换 `console.warn` 为 `log.warn` |
| | `index.ts` | `initLogger(config.logLevel)`；启动/关闭/信号/异常日志；新增 `uncaughtException`/`unhandledRejection` 钩子 |
| | `app.ts` | 新增启动流程 info/debug 日志 |
| 中间件 | `middleware/request-logger.ts` | 替换 `console.log`；按状态码分级（4xx→warn, 5xx→error）；debug 级输出请求体 |
| | `middleware/error-handler.ts` | 替换 `console.error`；附带 `req.method`/`req.path`；AppError 按严重程度分级 |
| Auth | `auth/auth-routes.ts` | 新增注册/登录成功(info)及失败(warn)日志 |
| | `auth/auth-service.ts` | 新增账号创建/登录调试日志；admin 已存在时的 debug 日志 |
| | `auth/middleware.ts` | 新增 API Key/JWT 认证失败的 debug/warn 日志（含脱敏 key 前缀） |
| | `auth/ip-rate-limiter.ts` | 新增 IP 限流触发 warn 日志（含 IP、计数、上限） |
| Proxy | `proxy/proxy-routes.ts` | 请求进入/上游选择/转发完成(info)；无可用上游(warn)；错误(warn/error) |
| | `proxy/upstream-selector.ts` | 上游选择过程 debug 日志（无模型回退/优先级匹配/命中） |
| | `proxy/model-strategy.ts` | 策略决策 debug 日志（优先级匹配/字母回退/健康状态变更） |
| | `proxy/request-forwarder.ts` | 转发开始/结束 debug；上游 HTTP 错误 warn；网络异常 error |
| | `proxy/rate-limiter.ts` | 用户 RPM/TPD 限流触发 warn 日志 |
| | `proxy/format-converter.ts` | OpenAI↔Anthropic 转换 debug；流式 message_start/stop/error 事件日志（chunk 级别不打） |
| | `proxy/distribution.ts` | API Key 选择 debug（fill/round-robin、key label） |
| Admin | `admin/admin-routes.ts` | 管理员登录/上游CRUD/模型优先级变更/用户CRUD 的 info 日志 |
| Upstream | `upstream/health-checker.ts` | 替换 `console.log`；健康恢复 info、仍不健康 warn、单次检查 debug |
| DB | `db/database.ts` | 数据库打开/创建/关闭 info 日志 |
| | `db/migrations.ts` | 迁移应用 info 日志；待定迁移计数 debug |
| Plugin | `plugin/plugin-loader.ts` | 插件加载/失败对应级别日志 |

## 设计决策

1. **模块级单例**：不放在 AppContext 中（`request-logger.ts`、`config.ts` 等不接收 ctx）
2. **利用已有 logLevel 配置**：`config.ts` 中早已定义 `logLevel`，无需修改配置接口
3. **零新依赖**：仅使用 Node 内置 `process.stdout/stderr.write`
4. **流式 hot path 不打 chunk 级日志**：`format-converter.ts` 的 `transform()` 每个 chunk 都被调用，禁止在此打 debug（会在流式请求下刷爆日志输出）
5. **Repository 文件暂不改动**：5 个 repo 文件的日志作为可选第二阶段

## 验证

- `npx tsc --noEmit` — 零错误
- `npm run lint` — 零错误/零警告
- `npm run build` — 构建成功

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是

## 已知限制

- 无日志文件输出（仅 stdout/stderr）
- 无 request-id 跨请求追踪
- Repository 层日志缺失（后续可补充）
- 日志格式为纯文本，未实现 JSON 格式选项

## 下一步

- 在生产环境通过 `logLevel` 调整日志级别
- 可选：为 repository 文件添加日志
- 可选：添加 `request-id` 通过 `AsyncLocalStorage` 关联同一请求的日志
- 可选：支持 `LOG_FORMAT=json` 输出 NDJSON 格式便于日志聚合
