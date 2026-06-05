# smart-router.ts

## 功能
智能路由模块，检测客户端 API 格式是否与上游 API 格式匹配。当匹配时可绕过 OpenAI 枢纽直接透传原始请求/响应（零格式转换），当不匹配时仍然回退到完整的星型枢纽转换链。

决策矩阵：
- openai→openai / anthropic→anthropic / gemini→gemini → 直通
- openai→anthropic / openai→gemini / anthropic→openai / gemini→openai → 单次转换
- anthropic↔gemini → 需要双转换（不可避免）

## 关系
### 调用 / 引用
- `../types.js` — `ApiType`, `PassthroughPlan`

### 提供
- `createRoutingPlan(clientApiType, upstreamApiType)` — 返回 PassthroughPlan
- `needsOutputConversion(clientApiType, upstreamApiType)` — 判断是否需要输出转换

### 被依赖
- `proxy-routes.ts`

## 关键词
### 函数
- `createRoutingPlan`
- `needsOutputConversion`
