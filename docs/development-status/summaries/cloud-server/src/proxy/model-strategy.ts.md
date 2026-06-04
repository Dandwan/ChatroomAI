# `cloud-server/src/proxy/model-strategy.ts`

## 功能
基于模型的上游选择策略引擎。维护全局上游健康状态，提供 `selectUpstreamForModel()` 按模型优先级依次选择健康上游并返回有效的 API 类型（模型级覆盖 > 上游全局默认）。无配置时回退到按名称字母排序选择。同时提供 `getAvailableModels()` 获取所有启用上游的模型名称并集（适配 `ModelEntry[]` 结构）。

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts` — `UpstreamWithKeys`、`ModelEntry`、`ModelPriority`
- `cloud-server/src/proxy/distribution.ts` — `selectKey`
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `selectUpstreamForModel()` — 按模型选择上游+Key+API类型
- `getAvailableModels()` — 获取所有可用模型名称列表
- `markUnhealthy()` / `markHealthy()` / `isUpstreamHealthy()` — 全局健康状态管理
- `ModelSelectionResult` — 类型（含 `upstream`、`apiKey`、`apiType`）

### 被依赖
- `cloud-server/src/proxy/upstream-selector.ts` — 委托调用
- `cloud-server/src/proxy/proxy-routes.ts` — 使用 `getAvailableModels`

## 关键词
### 函数
- `selectUpstreamForModel`
- `getAvailableModels`
- `markUnhealthy`
- `markHealthy`
- `isUpstreamHealthy`
- `resolveApiType`
- `upstreamHasModel`
