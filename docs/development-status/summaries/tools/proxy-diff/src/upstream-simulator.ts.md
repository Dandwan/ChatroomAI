# `tools/proxy-diff/src/upstream-simulator.ts`

## 功能
测试套件的核心组件 — 通配 HTTP 上游模拟器。创建一个 Express 服务器，使用 `ALL *` 路由捕获 CPA/ActiNet 的所有上游转发请求。不对请求体做任何格式假设，原样记录 `{method, path, headers, body}`。通过 `SessionRegistry` 按发送顺序匹配会话（单槽位 per-source 模式）。在两侧（CPA 和 ActiNet）的上游请求都到达后，选择其中一者的 HTTP 事务原封不动转发给真实上游，然后将真实上游响应同时 relay 给 CPA 和 ActiNet。

## 关系
### 调用 / 引用
- `types.ts` — `PendingSession`, `CapturedHttpTransaction`, `ProxyDiffConfig`
- `logger.ts` — `createLogger`

### 提供
- `sessionRegistry` — 全局 SessionRegistry 单例
- `createUpstreamSimulator()` — 创建 Express app
- `startUpstreamSimulator()` — 启动 server 并返回 Promise

### 被依赖
- `index.ts`
- `request-dispatcher.ts`（通过 sessionRegistry）
