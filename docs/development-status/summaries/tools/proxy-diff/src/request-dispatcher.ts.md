## 功能

请求分发器。并发向 CPA 和 ActiNet 发送相同的用户请求。记录点 2a/2b（dispatcher 出站请求 — 完整 HTTP 请求原文：URL、method、headers、body）。记录点 6a/6b（CPA/ActiNet 最终翻译响应）。使用 `Promise.all` 并发发送，每个请求 120 秒超时。

## 关系

### 调用 / 引用

- `types.ts` — `ProxyDiffConfig`、`PendingSession`、`FinalResponse`、`DispatcherOutbound`
- `upstream-simulator.ts` — `sessionRegistry`（注册 CPA/ActiNet 期望）
- `logger.ts` — `createLogger`

### 提供

- `dispatchRequest(config, session)` — 并发分发请求到 CPA 和 ActiNet

### 被依赖

- `index.ts`

## 关键词

### 函数

- `dispatchRequest(config: ProxyDiffConfig, session: PendingSession): Promise<void>`

### 内部函数

- `sendToProxy(target, request, sessionId, source)` — 向单个代理发送请求并记录出站数据
