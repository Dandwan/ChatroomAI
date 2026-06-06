# `tools/proxy-diff/src/request-dispatcher.ts`

## 功能
HTTP 请求分发器。将用户请求同时发送给 CPA 和 ActiNet。发送前通过 `sessionRegistry` 标记期望的上游来源，使上游模拟器能正确匹配。支持流式与非流式，2 分钟超时。并发执行 CPA 和 ActiNet 请求，独立计时。

## 关系
### 调用 / 引用
- `types.ts` — 类型
- `upstream-simulator.ts` — `sessionRegistry`
- `logger.ts` — `createLogger`

### 提供
- `dispatchRequest()` — 发送用户请求到 CPA 和 ActiNet

### 被依赖
- `index.ts`
