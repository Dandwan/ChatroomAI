# `cloud-server/src/proxy/upstream-selector.ts`

## 功能
上游选择器的对外入口。包装 `model-strategy.ts` 的核心选择逻辑，提供 `selectUpstream()` 统一接口。**v5: 适配 per-key 健康机制。**`markUnhealthy`/`markHealthy` 参数改为 `keyId`；`selectUpstream` 的 `excludeIds` 改为 `excludeKeyIds`（排除已尝试的 Key）；无模型名回退路径也过滤 unhealthy key。重新导出 `isKeyHealthy`、`getUnhealthyKeys`、`setKeyCheckHandler` 供 health-checker 使用。

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts`
- `cloud-server/src/proxy/model-strategy.ts` — 核心逻辑和健康管理
- `cloud-server/src/proxy/distribution.ts` — `selectKey`
- `cloud-server/src/logger.ts`

### 提供
- `selectUpstream()` — 选择最佳 upstream+key+API类型
- `markUnhealthy()` / `markHealthy()` — 健康标记（转发）
- `isKeyHealthy` / `getUnhealthyKeys` / `setKeyCheckHandler` — 重新导出

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts`
- `cloud-server/src/upstream/health-checker.ts`
