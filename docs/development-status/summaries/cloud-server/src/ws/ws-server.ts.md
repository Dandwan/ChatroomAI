# `cloud-server/src/ws/ws-server.ts`

## 功能
WebSocket 服务器创建与挂载模块。创建 `WebSocketServer`（ws 库）并挂载到 HTTP/HTTPS server 的 `/v1/ws` 路径。支持 API Key 认证（查询参数 `token=` 或 Authorization header），可配置 `wsAuth` 开关。连接后发送欢迎消息，支持 message/close/error 事件处理和消息回显。

## 关系
### 调用 / 引用
- `ws` — `WebSocketServer`
- `cloud-server/src/ws/ws-manager.ts` — `WsManager`
- `cloud-server/src/app-context.ts` — `AppContext`
- `cloud-server/src/logger.ts`

### 提供
- `createWsServer(server, ctx)` — 创建并返回 WsManager

### 被依赖
- `cloud-server/src/index.ts`
