# `tools/proxy-diff/src/proxy-forwarder.ts`

## 功能
通过 mihomo (Clash.Meta) 代理向真实上游转发 HTTP 事务。使用 undici 的 `ProxyAgent` 作为代理分发器，以完全相同的 `{method, path, headers, body}` 透传请求。不做任何格式解析或转换。支持自定义 API key 覆盖。

## 关系
### 调用 / 引用
- `types.ts` — `CapturedHttpTransaction`
- `logger.ts` — `createLogger`
- `undici` — `fetch`, `ProxyAgent`

### 提供
- `forwardToRealUpstream()` — 向真实上游转发 HTTP 事务

### 被依赖
- `upstream-simulator.ts`（通过函数参数注入）
- `index.ts`（构造注入函数时）
