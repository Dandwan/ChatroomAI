# `cloud-server/src/proxy/request-forwarder.ts`

## 功能
HTTP 请求转发器，负责将客户端请求转发到上游 API。支持流式（SSE 透传）和非流式转发。新增 `StreamForwardOptions` 支持自定义请求体和流式 TransformStream 转换（用于 Anthropic → OpenAI SSE 转换）。`forwardStreamRequest` 和 `forwardNonStreamRequest` 在上游失败时抛出错误（而非返回错误对象），供调用方 try-catch 处理重试。两个函数均接受新的可选 `proxyUrl` 参数，通过 `getProxyDispatcher()` 支持代理转发。

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`
- `express` — `Request`, `Response`

### 提供
- `forwardStreamRequest()` — 流式转发，支持可选的 body 覆盖和 streamTransformer
- `forwardNonStreamRequest()` — 非流式转发，接受自定义 body
- `ForwardResult` — 转发结果接口
- `StreamForwardOptions` — 流式转发选项

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts` — 代理路由调用转发函数

## 关键词
### 函数
- `forwardStreamRequest`
- `forwardNonStreamRequest`
### 接口
- `ForwardResult`
- `StreamForwardOptions`
