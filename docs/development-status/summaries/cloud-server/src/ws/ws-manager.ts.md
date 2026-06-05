# `cloud-server/src/ws/ws-manager.ts`

## 功能
WebSocket 连接管理器。维护 sessionId→WsSession 映射和 userId→Set<sessionId> 索引，支持连接注册/移除、活动时间更新、广播消息（字符串和 JSON）、单 session 发送和连接统计。

## 关系
### 调用 / 引用
- `ws` — `WebSocket`
- `cloud-server/src/logger.ts`

### 提供
- `WsManager` 类 — addConnection、removeConnection、removeByWs、touch、getSession、broadcast、broadcastJson、send、getStats
- `WsSession` 接口

### 被依赖
- `cloud-server/src/ws/ws-server.ts` — 创建 WsManager 实例
- `cloud-server/src/app-context.ts` — `wsManager` 引用
- `cloud-server/src/admin/admin-routes.ts` — 连接统计
