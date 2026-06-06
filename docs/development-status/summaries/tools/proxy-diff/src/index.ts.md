# `tools/proxy-diff/src/index.ts`

## 功能
proxy-diff 测试套件的 CLI 入口。使用 `commander` 解析命令行参数，加载配置（支持 CLI 覆盖），读取用户请求（文件或 stdin），初始化上游模拟器和记录器，创建会话并通过 `dispatchRequest` 执行对比测试，最后生成终端和 Markdown 双重报告。

## 关系
### 调用 / 引用
- `config.ts` — `loadConfig`
- `upstream-simulator.ts` — `createUpstreamSimulator`, `startUpstreamSimulator`, `sessionRegistry`
- `request-dispatcher.ts` — `dispatchRequest`
- `proxy-forwarder.ts` — `forwardToRealUpstream`
- `recorder.ts` — `initRecorder`, `recordSession`, `finalizeRun`
- `comparator.ts` — `compareAll`
- `reporter.ts` — `printConsoleReport`, `writeMarkdownReport`

### 提供
- CLI 入口：`proxy-diff [request-file] [options]`

### 被依赖
- `package.json` — `bin` 入口
