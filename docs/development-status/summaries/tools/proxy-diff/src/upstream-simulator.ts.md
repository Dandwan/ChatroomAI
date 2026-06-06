## 功能

上游模拟器 — 测试套件的核心。创建 Express 通配 HTTP 服务器，充当 CPA 和 ActiNet 的"假上游"。捕获两者翻译后的 HTTP 事务（method/path/headers/body，零格式假设），等待双方均到达后通过 mihomo 代理向真实上游转发其中一方的请求，然后将真实上游响应原封不动 relay 给 CPA 和 ActiNet。记录点 3a/3b（上游事务捕获）、记录点 4（真实上游响应）、记录点 5a/5b（relay 响应）。

包含 `SessionRegistry` 内部类：单槽匹配模型（每源一个槽位），避免依赖自定义 HTTP 头进行会话匹配。

## 关系

### 调用 / 引用

- `express` — HTTP 服务器框架
- `types.ts` — `ProxyDiffConfig`、`PendingSession`、`CapturedHttpTransaction`、`UpstreamResponse`、`UpstreamRelayResponse`
- `logger.ts` — `createLogger`

### 提供

- `sessionRegistry` — 全局 SessionRegistry 实例
- `createUpstreamSimulator(config, forwardToRealUpstream)` — 创建 Express app
- `startUpstreamSimulator(app, port)` — 启动 HTTP 服务器
- `SessionRegistry` 类 — 会话注册与匹配

### 被依赖

- `index.ts` — 创建和启动模拟器
- `request-dispatcher.ts` — 通过 `sessionRegistry` 注册期望
