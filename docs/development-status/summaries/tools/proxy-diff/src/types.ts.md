# `tools/proxy-diff/src/types.ts`

## 功能
定义 proxy-diff 测试套件的所有共享 TypeScript 接口和类型。包括用户请求描述 (`UserRequest`)、上游 HTTP 事务捕获 (`CapturedHttpTransaction`)、会话生命周期 (`PendingSession`)、配置结构 (`ProxyDiffConfig`) 和对比结果 (`DiffResult`)。

## 关系
### 提供
- `UserRequest` — 用户提供的 HTTP 请求描述符（供 CLI/request-dispatcher 使用）
- `CapturedHttpTransaction` — 上游模拟器捕获的 HTTP 事务
- `PendingSession` — 一次对比测试的完整状态
- `ProxyDiffConfig` — 全量配置接口
- `DiffResult` — 对比分析结果

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
- `UpstreamResponse`
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
- `SessionStatus`
