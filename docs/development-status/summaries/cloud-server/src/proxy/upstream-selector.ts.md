# `cloud-server/src/proxy/upstream-selector.ts`

## 功能
上游选择器的对外入口。包装 `model-strategy.ts` 中的核心选择逻辑，提供统一的 `selectUpstream()` 接口。支持有模型名（委托给模型策略）和无模型名（按名称字母排序选第一个健康上游）两种调用路径。

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts` — `UpstreamWithKeys`、`ModelPriority`
- `cloud-server/src/proxy/model-strategy.ts` — 核心选择逻辑和健康状态管理
- `cloud-server/src/proxy/distribution.ts` — `selectKey`

### 提供
- `selectUpstream()` — 选择最佳上游+Key+API类型
- `markUnhealthy()` / `markHealthy()` — 健康状态标记（转发）
- `isUpstreamHealthy()` — 健康状态查询（转发）
- `SelectionResult` — 同 `ModelSelectionResult`

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts` — 请求路由
- `cloud-server/src/upstream/health-checker.ts` — 健康检查

## 关键词
### 函数
- `selectUpstream`
- `markUnhealthy`
- `markHealthy`
- `isUpstreamHealthy`
