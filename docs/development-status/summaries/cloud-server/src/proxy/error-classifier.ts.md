# `cloud-server/src/proxy/error-classifier.ts`

## 功能
**上游错误分类器。** 判断一个上游错误是否应该将 API Key 标记为不健康。仅以下错误类型触发标记：网络不可达（fetch failed / ENOTFOUND / ECONNREFUSED / ETIMEDOUT 等）、上游服务端错误（5xx）、认证/计费/Key 无效错误（401/402/403，含余额不足）、速率限制（429）。客户端请求错误（400/404/405/422）、JSON 反序列化失败、参数校验错误等不标记——因为换一个 Key 重试会得到同样结果。

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts`

### 提供
- `shouldMarkUnhealthy(input: ClassifyErrorInput)` — 返回 `true` 时应标记 key 为不健康
- `ClassifyErrorInput` 接口

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts` — v17 `markUnhealthy` 调用前执行分类判断

## 关键词
### 函数
- `shouldMarkUnhealthy`
### 接口
- `ClassifyErrorInput`
