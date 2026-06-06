# `cloud-server/src/proxy/request-forwarder.ts`

## 功能
HTTP 请求转发器，负责将客户端请求转发到上游 API。支持流式（SSE 透传）和非流式转发。`StreamForwardOptions` 支持自定义请求体、流式 TransformStream 转换（用于 Anthropic → OpenAI SSE 转换），以及 `outputTransformer`（用于 OpenAI → 原生格式的第二阶段转换）。`forwardStreamRequest` 和 `forwardNonStreamRequest` 在上游失败时抛出错误（而非返回错误对象），供调用方 try-catch 处理重试。两个函数均接受新的可选 `proxyUrl` 参数，通过 `getProxyDispatcher()` 支持代理转发。**v8: `StreamForwardOptions` 新增 `outputTransformer` 字段，支持双 transformer 链式管道（上游格式→OpenAI→原生格式）。v9: 流式转发不再透传客户端请求头（仅发送 Content-Type + Authorization），防止 Content-Length 不匹配导致上游挂起；新增 120s 超时和 null body 防御；流式结束后调用 res.end()。v10: 转发 Anthropic 协议头（`anthropic-version`、`anthropic-beta`、`x-api-key`）到上游；`forwardNonStreamRequest()` 新增 `extraHeaders` 参数。** **v11: `StreamForwardOptions` 新增 `skipTransformers` 标志 — 当设为 true 时完全绕过 TransformStream 管道，直接将上游 SSE 原始字节写入客户端。用于智能直通（client 格式 == upstream 格式）。** **v12: 移除 Anthropic 协议头转发（对齐 CPA）— `forwardStreamRequest()` 不再将 `anthropic-version`/`anthropic-beta`/`x-api-key` 转发到上游 OpenAI 兼容 API。`extraHeaders` 参数保留在签名中供未来扩展使用。**

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`
- `express` — `Request`, `Response`

### 提供
- `forwardStreamRequest()` — 流式转发，支持可选的 body 覆盖、streamTransformer 和 outputTransformer，自动转发 Anthropic 协议头
- `forwardNonStreamRequest()` — 非流式转发，接受自定义 body 和 extraHeaders
- `ForwardResult` — 转发结果接口
- `StreamForwardOptions` — 流式转发选项

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts` — 代理路由调用转发函数

## 关键词
### 函数
- `forwardStreamRequest`
- `forwardNonStreamRequest`
- `buildTargetUrl`
### 接口
- `ForwardResult`
- `StreamForwardOptions`
