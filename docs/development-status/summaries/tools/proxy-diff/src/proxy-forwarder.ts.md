## 功能

代理转发器。通过 mihomo 代理（SOCKS5/HTTP）将捕获的 HTTP 事务原封不动转发到真实上游。使用 undici ProxyAgent，保持原始 method/path/headers/body 不变。返回完整上游响应（status + headers + body 原始字符串）。

## 关系

### 调用 / 引用

- `undici` — `fetch`、`ProxyAgent`
- `types.ts` — `CapturedHttpTransaction`、`UpstreamResponse`
- `logger.ts` — `createLogger`

### 提供

- `forwardToRealUpstream(tx, realUpstreamBaseUrl, mihomoUrl, realUpstreamApiKey?)` — 转发事务到真实上游

### 被依赖

- `upstream-simulator.ts` — 作为回调传入
- `index.ts` — 构造回调闭包
