# `cloud-server/src/proxy/distribution.ts`

## 功能
上游 API Key 分发模块。支持两种分发策略：`fill`（始终使用第一个可用 key）和 `round_robin`（选择使用次数最少的 key 以实现负载均衡）。通过 `selectKey()` 根据上游配置的 `distribution_mode` 自动选择策略，并维护全局使用计数器（含自动清理）。

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts` — `UpstreamWithKeys`、`UpstreamApiKey`
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `selectKey()` — 根据上游分发模式选择 API Key
- `selectKeyFill()` — fill 模式选择
- `selectKeyRoundRobin()` — round_robin 模式选择
- `DistributionMode` — 分发模式类型

### 被依赖
- `cloud-server/src/proxy/model-strategy.ts`
- `cloud-server/src/proxy/upstream-selector.ts`

## 关键词
### 函数
- `selectKey`
- `selectKeyFill`
- `selectKeyRoundRobin`
- `getKeyCounter`
- `incrementKeyCounter`

### 类型
- `DistributionMode`
