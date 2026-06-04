# 024 — Per-Key 健康机制重构

**日期**：2026-06-04

## 范围

将 cloud-server 的健康检查、容错追踪、重试机制从 **per-upstream**（按上游）改为 **per-key**（按 API Key）粒度。每个 Key 独立追踪健康状态、独立容错计数、独立恢复检测。

## 变更的代码区域

### 修改：`cloud-server/src/types.ts`
- `Upstream` 移除 `fault_tolerance`，新增 `key_fault_tolerance: number | null`（该上游下 Key 的默认容错值）
- `UpstreamApiKey` 新增 `fault_tolerance: number`（每个 Key 独立的容错阈值）

### 修改：`cloud-server/src/config.ts`
- `ServerConfig` 新增 `defaultFaultTolerance` 全局配置（环境变量/JSON，默认 0）

### 修改：`cloud-server/src/db/migrations.ts`
- v5 迁移：`upstream_api_keys` 加 `fault_tolerance INTEGER NOT NULL DEFAULT 0`；`upstreams` 加 `key_fault_tolerance INTEGER`

### 修改：`cloud-server/src/db/repositories/upstream-repo.ts`
- `upstreamFromRow()` — `fault_tolerance` → `key_fault_tolerance`
- `keyFromRow()` — 新增 `fault_tolerance` 解析
- `create()` — `fault_tolerance` → `key_fault_tolerance`
- `update()` — 字段列表同步更新
- `createKey()` / `updateKey()` — 支持 `fault_tolerance`

### 修改：`cloud-server/src/proxy/failure-tracker.ts`
- 参数语义从 `upstreamId` 改为 `keyId`（结构不变，日志适配）

### 重写：`cloud-server/src/proxy/model-strategy.ts`
- `unhealthyUpstreams: Set<upstreamId>` → `unhealthyKeys: Set<keyId>`
- `markUnhealthy(keyId)` — 标记 Key 不健康并触发即时检测（通过 `setKeyCheckHandler` 注册的回调）
- `markHealthy(keyId)` / `isKeyHealthy(keyId)` — Key 级健康管理
- 新增 `getUnhealthyKeys()` — 返回所有 unhealthy key ID
- 新增 `setKeyCheckHandler()` — 注册健康检测回调
- `selectUpstreamForModel()` — `excludeIds: Set<upstreamId>` → `excludeKeyIds: Set<keyId>`；内部新增 `getAvailableKeys()` 过滤 healthy+untried key
- 选择逻辑：同 upstream 内不同 key 轮转，所有 key 失败后才跳到下一 upstream

### 修改：`cloud-server/src/proxy/upstream-selector.ts`
- `markUnhealthy`/`markHealthy` 参数改为 `keyId`
- `selectUpstream` 的 `excludeIds` → `excludeKeyIds`
- 无模型名回退路径增加 key 健康过滤
- 重新导出 `isKeyHealthy`、`getUnhealthyKeys`、`setKeyCheckHandler`

### 修改：`cloud-server/src/proxy/proxy-routes.ts`
- 重试循环：`triedIds: Set<upstreamId>` → `triedKeyIds: Set<keyId>`
- `failureTracker.recordFailure(selected.apiKey.id, selected.apiKey.fault_tolerance)`
- `failureTracker.recordSuccess(selected.apiKey.id)`
- `markUnhealthy(selected.apiKey.id)`
- `triedKeyIds.add(selected.apiKey.id)`

### 重写：`cloud-server/src/upstream/health-checker.ts`
- 不再按 unhealthy upstream 遍历，改为遍历 `unhealthyKeys` 中的每个 key
- 通过 `setKeyCheckHandler` 注册回调 → `markUnhealthy` 触发即时异步检测（`setTimeout(0)` + `pendingChecks` Set 去重）
- 定时器仍然每 10 分钟批量检测所有 unhealthy key
- `checkKeyById()` 查找 key 所属 upstream → 执行探测 → 恢复/保持标记

### 修改：`cloud-server/src/admin/admin-routes.ts`
- POST `/api/admin/upstreams` — `fault_tolerance` → `key_fault_tolerance`；创建 Key 时容错值继承链：请求参数 > upstream > 全局默认
- POST `/api/admin/upstreams/:id/keys` — 接受 `fault_tolerance`
- 新增 `PUT /api/admin/upstreams/:id/keys/:keyId` — 更新 Key（含容错）

### 修改：`cloud-server/admin-ui/src/api.ts`
- `UpstreamData.fault_tolerance` → `key_fault_tolerance`
- `api_keys` 数组项新增 `fault_tolerance: number`
- 新增 `UpstreamKeyData` 接口
- `createUpstream` 参数改为 `key_fault_tolerance`
- 新增 `updateUpstreamKey()` 函数

### 修改：`cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`
- 表单："容错次数" → "Key 默认容错次数"（可选，`keyFaultTolerance`）
- Key 列表每行新增容错次数输入框（`handleUpdateKeyFt`）
- 表格列头："容错" → "Keys (容错)"

### 修改：`cloud-server/admin-ui/src/styles/admin.css`
- 新增 `.admin-key-code`、`.admin-key-ft`、`.admin-input-xs` 样式

### 新建/更新：代码摘要（13 个文件）
- 更新所有修改文件的摘要，新建 `admin.css.md`

## 设计决策

1. **三层容错配置**：Key > Upstream `key_fault_tolerance` > 全局 `defaultFaultTolerance`。创建 Key 时自动继承，可单独覆盖。
2. **同上游内 Key 优先轮转**：重试循环先尝试同一 upstream 的不同 Key，全部失败后再跳到下一 upstream。
3. **即时检测 + 定时兜底**：`markUnhealthy` 触发 `setTimeout(0)` 异步检测（去重），同时 10 分钟定时器批量检测。
4. **只检查 unhealthy key**：不遍历全部 key，保持与之前相同的检测策略。
5. **容错默认值 0**：新 Key 默认 `fault_tolerance = 0`（首次失败即标记），向后兼容。

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npx tsc --noEmit` — 前端：零错误
- `npm run build` — admin-ui：构建成功（386 KB JS, 6.5 KB CSS）

## 决策关卡

- 方案已提出：是（含完整工程方案和需求讨论）
- 用户确认已收到：是
- 需求修订：
  - fault_tolerance 三层配置（全局 → 上游 → Key）
  - 同上游内 Key 优先轮转
  - 只检查 unhealthy key
  - 即时检测模式（key 变 unhealthy 即触发）
  - 加数据库列持久化

## 已知限制

- 内存中的 `unhealthyKeys` 和 `failureTracker` 在服务器重启后丢失
- 流式请求重试仅在上游返回错误状态码时生效
- `distribution.ts` 未修改（接收已过滤的 key 列表）

## 下一步

- 部署到云服务器验证 per-key 健康机制
- 观察同 upstream 内 key 轮转重试效果
- 可选：将 `failureTracker` 计数器持久化到 DB
