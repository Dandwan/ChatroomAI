# `cloud-server/src/proxy/model-strategy.ts`

## 功能
基于模型的 upstream+key 选择策略引擎。**v5: 健康状态从 per-upstream (`unhealthyUpstreams: Set<upstreamId>`) 改为 per-key (`unhealthyKeys: Set<keyId>`)。** 每个 API Key 独立追踪健康状态。`markUnhealthy()` 触发即时健康检测（通过回调 `setKeyCheckHandler` 注册）。`selectUpstreamForModel()` 按模型优先级依次筛选 upstream → 过滤出健康的 key → 根据 distribution_mode 选择，同 upstream 内不同 key 优先轮转。`getAvailableModels()` 聚合所有启用 upstream 的模型并集。**v13: 新增 `getPriorityGroups()` — 构建优先级组列表供重试循环使用，每组包含 upstream、priority 和预解析的 apiType。** 新增 `PriorityGroup` 接口。

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts`
- `cloud-server/src/proxy/distribution.ts` — `selectKey`
- `cloud-server/src/proxy/failure-tracker.ts` — `failureTracker`
- `cloud-server/src/logger.ts`

### 提供
- `selectUpstreamForModel()` — 按模型选择 upstream+key+API类型
- `getPriorityGroups()` — **v13** 构建优先级组列表，供重试循环按组遍历
- `getAvailableModels()` — 所有可用模型列表
- `markUnhealthy()` / `markHealthy()` / `isKeyHealthy()` / `getUnhealthyKeys()` — per-key 健康管理
- `setKeyCheckHandler()` — 注册健康检测回调（由 health-checker 调用）
- `ModelSelectionResult` 类型
- `PriorityGroup` 类型 — **v13** 优先级组，包含 upstream、priority、apiType

### 被依赖
- `cloud-server/src/proxy/upstream-selector.ts`
- `cloud-server/src/proxy/proxy-routes.ts`
- `cloud-server/src/upstream/health-checker.ts`
