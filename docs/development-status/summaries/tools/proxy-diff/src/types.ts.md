## 功能

proxy-diff 测试套件的核心数据类型定义。包含所有接口/类型，从用户输入到最终对比结果的完整数据模型。强调接口无关性：所有 HTTP body 使用 `string` 类型，不预设 API 格式（OpenAI/Anthropic/Gemini/未知）。

## 关系

### 提供

- `UserRequest` — 用户提供的 HTTP 请求描述符
- `DispatcherOutbound` — dispatcher 发往 CPA/ActiNet 的原始出站请求
- `CapturedHttpTransaction` — upstream-sim 捕获的 CPA/ActiNet 上游事务
- `UpstreamResponse` — 真实上游完整响应（status+headers+body）
- `UpstreamRelayResponse` — upstream-sim relay 给 CPA/ActiNet 的响应
- `FinalResponse` — CPA/ActiNet 的最终响应
- `PendingSession` — 单次对比会话（含全部 6 个记录点）
- `ProxyDiffConfig` — 完整配置
- `DiffResult` — 结构化对比结果
- `RunRecord` — 运行记录

### 被依赖

- `config.ts`
- `upstream-simulator.ts`
- `request-dispatcher.ts`
- `proxy-forwarder.ts`
- `recorder.ts`
- `comparator.ts`
- `reporter.ts`
- `index.ts`

## 关键词

### 接口

- `UserRequest`
- `CapturedHttpTransaction`
- `DispatcherOutbound`
- `UpstreamResponse`
- `UpstreamRelayResponse`
- `FinalResponse`
- `PendingSession`
- `ProxyTargetConfig`
- `ProxyForwardConfig`
- `RealUpstreamConfig`
- `TestSuiteConfig`
- `ProxyDiffConfig`
- `DiffResult`
- `RunRecord`

### 类型

- `SessionStatus` — `'waiting_cpa' | 'waiting_actinet' | 'waiting_upstream' | 'complete' | 'error'`
