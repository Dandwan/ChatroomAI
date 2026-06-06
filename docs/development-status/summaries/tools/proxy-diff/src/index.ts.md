## 功能

CLI 入口。使用 commander 解析命令行参数，编排代理对比测试的完整生命周期：

1. 加载配置（JSON 文件 + CLI 覆盖）
2. 加载用户请求（JSON 文件或 stdin）
3. 启动 upstream-simulator（Express 服务器）
4. 创建 session 并 dispatch 到 CPA/ActiNet
5. 运行 comparator 对比
6. 生成终端报告和 Markdown 报告
7. 清理（关闭服务器、清空注册表）

## 关系

### 调用 / 引用

- `commander` — CLI 框架
- `config.ts` — `loadConfig`
- `upstream-simulator.ts` — `createUpstreamSimulator`、`startUpstreamSimulator`、`sessionRegistry`
- `request-dispatcher.ts` — `dispatchRequest`
- `proxy-forwarder.ts` — `forwardToRealUpstream`
- `recorder.ts` — `initRecorder`、`recordSession`、`finalizeRun`
- `comparator.ts` — `compareAll`
- `reporter.ts` — `printConsoleReport`、`writeMarkdownReport`
- `logger.ts` — `createLogger`
- `types.ts` — `UserRequest`、`PendingSession`、`RunRecord`

### 被依赖

- CLI 直接入口（`node dist/index.js`）

## 关键词

### 函数

- `main(): Promise<void>` — 主流程
- `generateSessionId(): string` — 生成唯一 session ID
