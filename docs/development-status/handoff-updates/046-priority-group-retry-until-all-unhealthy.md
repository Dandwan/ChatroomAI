# 046 — 重构代理重试逻辑：优先级内循环重试直到所有 key 标记 unhealthy

**日期**：2026-06-06
**类型**：重构（Refactor）

## 范围

重写 `forwardChatCompletion()` 的重试循环，从"每个 key 只试一次、全局 `triedKeyIds` 排除"改为"同一优先级内循环重试所有 healthy key，直到全部超过容错阈值标记为 unhealthy 后才进入下一优先级"。

## 根因

用户反馈 ActiNet 云服务完全不返回任何内容。SSH 排查发现：

1. 所有 opencode.ai 上游 API key 均余额不足（401 Insufficient balance）
2. 健康检查器频繁振荡标记 key 的 healthy/unhealthy 状态
3. 旧重试循环在 key 仅被 `triedKeyIds` 排除（但尚未超过容错阈值标记 unhealthy）时就直接返回错误

用户设计意图：应该持续重试当前优先级的 key，直到所有 key 都超过容错次数被标记 unhealthy，才进入下一优先级或返回错误。

## 变更的代码区域

### 修改：`cloud-server/src/proxy/model-strategy.ts`（~55 行新增）
- 新增 `PriorityGroup` 接口 — 优先级组：包含 upstream、priority、预解析的 apiType
- 新增 `getPriorityGroups()` 导出函数 — 构建优先级组有序列表：
  - 配置的 model_priorities（按 priority 升序）
  - 剩余含该 model 的 upstream（按名称字母序，priority=Infinity 作为 fallback）
  - 无 model 时：所有 enabled upstream 按名称字母序（priority=0）

### 重写：`cloud-server/src/proxy/proxy-routes.ts`（~220 行变化）
- **import 变更**：移除 `selectUpstream`（不再使用），新增 `getPriorityGroups`、`isKeyHealthy`（from model-strategy）、`selectKey`（from distribution）
- **重试循环重写**：`forwardChatCompletion()` 从扁平 `while(true)` + `triedKeyIds` 改为两级循环：
  - **外层**：`for (const group of priorityGroups)` — 按优先级组遍历
  - **内层**：`while (true)` + `healthyKeys` 快照 — 每轮刷新 healthy key 列表，循环尝试直到全部 unhealthy
  - **每轮**：`triedThisRound` 临时排除集（每轮重置），尝试所有 healthy key
  - 失败后若 `shouldMark`（超过容错阈值）→ `markUnhealthy(keyId)` → 该 key 下轮被过滤
  - 若某轮所有 key 仍 healthy → 新一轮自动重试
  - 某组所有 key unhealthy → `break` 到下一优先级组
- **日志增强**：新增 `round`（当前组第几轮重试）、`priority`、`totalAttempts`（全局累计）、`priorityGroupCount` 字段
- 转发逻辑、容错语义、success/failure 路径保持不变

### 更新：代码摘要（2 个文件）
- `model-strategy.ts.md` — 新增 `getPriorityGroups()`、`PriorityGroup` 类型说明
- `proxy-routes.ts.md` — 新增 v13 重试逻辑描述，更新依赖关系（移除 upstream-selector 非 `markUnhealthy` 引用）

## 设计决策

1. **优先级分组外置**：`getPriorityGroups()` 在 `model-strategy.ts` 中独立构建，`forwardChatCompletion` 只负责遍历。保持 `selectUpstreamForModel()` 不变，供其他调用者使用。
2. **per-round 排除而非全局排除**：`triedThisRound` 每轮重置，允许同一 key 在后续轮次中重试。只有超过容错阈值真正标记 unhealthy 才永久排除。
3. **保留 `selectKey()` 调用**：key 分布策略（fill/round_robin）不变，仅传入过滤后的 `availableKeys`。
4. **日志 backward-compatible**：新增字段追加到日志对象，不影响现有日志解析。

## 验证

- [x] `npx tsc --noEmit` — cloud-server：零新增错误（3 个预存在错误在 `request-recorder.ts` 和 `format-converter.ts`，与本次改动无关）
- [x] `selectUpstream` 引用确认已从 `proxy-routes.ts` 中完全移除
- [ ] 部署到 `dandwan.site` 验证实际请求的重试行为
- [ ] 观察新日志字段（`round`、`priority`、`totalAttempts`）确认优先级内重试逻辑正确

## 决策关卡

- 方案已提出：是（含详细工程方案、新旧逻辑对比表、重试行为矩阵）
- 用户确认已收到：是（2026-06-06）

## 下一步

1. 构建 Docker 镜像并部署到 `dandwan.site`
2. 通过 Admin UI 为 OpenCode 上游设置合适的 `key_fault_tolerance`（建议 3-5）
3. 观察生产日志中 `round` 字段，验证多轮重试行为
4. 充值 opencode.ai API key 余额或添加新 key
