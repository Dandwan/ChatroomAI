# 023 — 上游容错机制 & 请求重试

**日期**：2026-06-04

## 范围

为 cloud-server 代理层实现两个核心改进：
1. **容错次数（fault_tolerance）**：上游新增可配置的容错次数，连续失败超过该阈值才标记为 unhealthy（默认 0 = 失败一次即标记，保持现有行为）
2. **请求重试**：用户请求失败时，若存在其他健康的备选上游，自动按优先级顺序重试下一个，直到全部试完

## 变更的代码区域

### 新建：`cloud-server/src/proxy/failure-tracker.ts`
- 内存中的连续失败追踪器（`FailureTracker` 类）
- `recordFailure()` — 递增计数器，返回是否超过容错阈值
- `recordSuccess()` — 成功后重置计数器
- `reset()` — 上游恢复健康时清除
- 使用 `Map<string, number>`，O(1) 操作，Node.js 单线程天然安全

### 修改：`cloud-server/src/types.ts`
- `Upstream` 接口新增 `fault_tolerance: number` 字段

### 修改：`cloud-server/src/db/migrations.ts`
- 新增 v4 迁移：`ALTER TABLE upstreams ADD COLUMN fault_tolerance INTEGER NOT NULL DEFAULT 0`

### 修改：`cloud-server/src/db/repositories/upstream-repo.ts`
- `upstreamFromRow()` — 解析 `fault_tolerance`（默认 0）
- `create()` — INSERT 包含 `fault_tolerance` 列
- `update()` — 支持更新 `fault_tolerance` 字段

### 修改：`cloud-server/src/proxy/model-strategy.ts`
- `selectUpstreamForModel()` 新增可选参数 `excludeIds?: Set<string>`，跳过已尝试的上游
- `markHealthy()` 恢复健康时同时调用 `failureTracker.reset()` 重置计数器
- 导入 `failureTracker`

### 修改：`cloud-server/src/proxy/upstream-selector.ts`
- `selectUpstream()` 新增 `excludeIds` 参数，透传给 `selectUpstreamForModel()`
- 无模型名回退路径也支持 `excludeIds` 排除

### 重写：`cloud-server/src/proxy/proxy-routes.ts` (核心变更)
- **重试循环**：`POST /v1/chat/completions` 处理器改为 `while(true)` 循环
  - 每次迭代通过 `selectUpstream(upstreams, modelName, modelPriorities, triedIds)` 选择上游
  - 成功 → `failureTracker.recordSuccess()` → 返回响应
  - 失败 → `failureTracker.recordFailure()` → 检查容错阈值 → `triedIds.add()` → 继续循环
  - 无可选上游 → 返回最后一个错误
- 流式和非流式路径统一重试逻辑
- 导入 `failureTracker` 和 `ForwardResult`

### 修改：`cloud-server/src/admin/admin-routes.ts`
- POST `/api/admin/upstreams` — 接受 `fault_tolerance` 参数
- PUT `/api/admin/upstreams/:id` — `fault_tolerance` 自动通过 `req.body` 透传

### 修改：`cloud-server/admin-ui/src/api.ts`
- `UpstreamData` 接口新增 `fault_tolerance: number`
- `createUpstream` 参数新增 `fault_tolerance?: number`

### 修改：`cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`
- 表单新增「容错次数」输入框（数字类型，min=0，默认 0）
- 表格新增「容错」列（0 显示为"即时"，非 0 显示数值）
- `handleSubmit` 提交时包含 `fault_tolerance`
- `startEdit` 编辑时回填 `fault_tolerance`
- `resetForm` 重置时清空为 0

### 新建：代码摘要（10 个文件）
- `summaries/cloud-server/src/types.ts.md`
- `summaries/cloud-server/src/db/migrations.ts.md`
- `summaries/cloud-server/src/db/repositories/upstream-repo.ts.md`
- `summaries/cloud-server/src/proxy/failure-tracker.ts.md`
- `summaries/cloud-server/src/proxy/model-strategy.ts.md`
- `summaries/cloud-server/src/proxy/upstream-selector.ts.md`
- `summaries/cloud-server/src/proxy/proxy-routes.ts.md`
- `summaries/cloud-server/src/admin/admin-routes.ts.md`
- `summaries/cloud-server/admin-ui/src/api.ts.md`
- `summaries/cloud-server/admin-ui/src/pages/UpstreamsPage.tsx.md`

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npm run build` — admin-ui：构建成功（386 KB JS, 6.2 KB CSS）

## 决策关卡

- 方案已提出：是（完整工程方案，含数据模型、重试循环伪代码、设计决策表）
- 用户确认已收到：是

## 设计决策

1. **失败追踪用内存 Map**：高频写入不能用 DB（每次请求都会触发），重启后从 0 开始是可接受的
2. **容错默认值 0**：向后兼容——现有 upstream 行为不变
3. **重试用 `excludeIds` 而非临时标记 unhealthy**：语义清晰，排除集只在单次请求生命周期内有效
4. **重试顺序自然遵循模型优先级→字母排序**：无需新增逻辑
5. **`markHealthy()` 时重置失败计数器**：上游恢复后不应该保留旧失败记录

## 已知限制

- 内存中的 `failureTracker` 在服务器重启后丢失——所有计数器从 0 开始
- 容错次数是上游级别配置，不支持 per-model 粒度
- 流式请求重试仅当上游在开始流式传输前返回错误状态码时才生效（`response.ok === false` 时不发送头部）
- `excludeIds` 使用 `Set` 而非 `Set<string>` 参数声明（类型擦除后无运行时差异）

## 下一步

- 部署到云服务器并在 Admin UI 中为每个上游配置合适的容错次数
- 观察生产环境中重试日志，评估容错阈值是否合理
- 可选：添加 per-model 容错次数覆盖
- 可选：将 `failureTracker` 计数器持久化到 DB 以在重启后保留
