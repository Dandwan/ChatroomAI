# 047 — ActiNet 健康页面手动修改 Key 健康标记

**日期**：2026-06-06
**类型**：新增功能（New Feature）

## 范围

在 ActiNet Admin UI 的健康监控页面添加手动修改 Key 健康标记的能力。管理员可逐 Key、按上游分组批量、或全局批量切换健康/不健康状态。

## 变更的代码区域

### 修改：`cloud-server/src/admin/admin-routes.ts`（~60 行新增）
- 新增 `PUT /api/admin/health/keys/:keyId` — 手动设置单个 Key 健康状态
  - 校验 `healthy: boolean` 必填
  - 验证 keyId 存在于某个 upstream → 不存在返回 404
  - 调用 `markHealthy`/`markUnhealthy`
- 新增 `POST /api/admin/health/keys/batch` — 批量设置 Key 健康状态
  - 校验 `keyIds: string[]` 非空 + `healthy: boolean` 必填
  - 不存在的 keyId 跳过并记入 `skipped` 列表
  - 返回 `{ updated, skipped, healthy }`

### 修改：`cloud-server/admin-ui/src/api.ts`（~15 行新增）
- 新增 `updateKeyHealth(keyId, healthy)` — 单个 Key 健康标记 API 调用
- 新增 `batchUpdateKeyHealth(keyIds, healthy)` — 批量 Key 健康标记 API 调用

### 修改：`cloud-server/admin-ui/src/pages/HealthPage.tsx`（~140 行变更）
- 每行 Key 新增操作按钮（"标记健康"/"标记不健康"），操作中显示 "…" 禁用态
- 每个上游分组标题行新增批量操作按钮（"标记全部健康"/"标记全部不健康"）
- 统计卡片下方新增全局批量操作栏（"全部标记健康 (N)"/"全部标记不健康 (N)"）
- 新增 `operating`/`batchOperating` Set state 追踪操作状态
- 单个操作成功后乐观更新本地状态（无需等待 30s 刷新）
- 批量操作成功后全量刷新确保一致性

### 修改：`cloud-server/admin-ui/src/styles/admin.css`（~20 行新增）
- 新增 `.admin-health-action-heal`/`.admin-health-action-sick` — 绿色/红色操作按钮
- 新增 `.admin-health-batch-bar` — 全局批量操作栏 flex 布局
- 新增 `.admin-health-group-header` — 分组标题行 flex 布局

### 更新：代码摘要（4 个文件）
- `admin-routes.ts.md` — 新增 v14 健康标记端点 + `model-strategy.ts` 依赖
- `api.ts.md` — 新增 `updateKeyHealth`/`batchUpdateKeyHealth` + `HealthPage.tsx` 被依赖
- `HealthPage.tsx.md` — 新增 v14 手动标记功能描述 + 新增 API 引用
- `admin.css.md` — 新增 v14 健康操作样式

## 设计决策

1. **markHealthy/markUnhealthy 复用**：不新增模型层代码，直接复用 `model-strategy.ts` 已有的健康标记函数
2. **批量端点独立的 POST**：`POST /health/keys/batch` 而非 `PUT`，因为是集合级操作
3. **批量容错**：不存在的 keyId 跳过而非整体失败，确保部分有效 keyId 可正常操作
4. **乐观更新 vs 全量刷新**：单个操作使用乐观更新（响应快），批量操作全量刷新（确保一致）
5. **markUnhealthy 触发即时检测**：手动标记不健康会触发 `scheduleImmediateCheck`，若 Key 实际健康会被自动恢复

## 验证

- [x] `npx tsc --noEmit` — cloud-server：零新增错误（3 个预存在错误，与本次无关）
- [x] `npx tsc --noEmit` — admin-ui：零错误
- [x] `npx vite build` — admin-ui：构建成功（414 KB JS, 9.4 KB CSS）
- [ ] 部署到 `dandwan.site` 验证手动标记功能

## 决策关卡

- 方案已提出：是（含详细工程方案，两轮迭代）
- 用户确认已收到：是（2026-06-06）
- 需求修订：
  1. 方案 A（状态列旁小按钮）— 确认
  2. 不需要确认对话框 — 确认
  3. 支持批量操作（分组 + 全局）— 确认

## 已知限制

- 健康状态不持久化（`unhealthyKeys` 是内存 Set），服务器重启后丢失 — 与现有设计一致
- 手动标记 unhealthy 的 Key 若实际健康，即时检测会将其恢复为 healthy（预期行为）
- 手动标记 healthy 的 Key 若实际不可用，下次请求失败后容错计数器递增，超阈值重新标记 unhealthy（预期行为）
- 批量操作无事务性 — 部分 Key 可能成功、部分跳过

## 下一步

- 部署 Docker 镜像到 `dandwan.site` 验证
- 可选：将健康状态持久化到数据库（重启后保留）
- 可选：增加操作审计日志
