# 020 — ActiNet 启动检测、模型管理 & 上游/模型体系重构

**日期**：2026-06-04

## 范围

四个核心变更：
1. 前端启动时 ActiNet 连通性检测（失败 → 软退出，保留凭据）
2. ActiNet 设置页增加模型启用/禁用 UI（默认模型「快速」「专家」）
3. 聊天模型选择器新增 ActiNet 分组
4. Cloud server 上游体系重构：上游声明可提供模型列表，去掉全局优先级，新增按模型独立优先级的调度策略

## 前端变更

### 修改：`src/services/cloud-auth.ts`
- 新增 `verifyCloudAuth()`：调用 `GET /api/auth/me` 验证 token 是否有效
- 新增 `deactivateCloudAuth()`：软退出 — 清除 token/apiKey，保留 username/email/serverUrl
- `clearCloudAuth()` 保持不变（硬退出 — 完全清除）

### 新建：`src/services/actinet-models.ts`
- `DEFAULT_ACTINET_MODELS`：「快速」「专家」默认启用
- `getStoredActiNetModels()` / `saveActiNetModelPreferences()`：本地持久化模型启用偏好
- `getEffectiveActiNetModels()`：有存储偏好则用偏好，否则用默认
- `fetchActiNetModelsFromServer()`：从 cloud-server `/v1/models` 拉取模型列表
- `mergeActiNetModels()`：合并远程列表与本地偏好

### 修改：`src/state/types.ts`
- `AppSettings` 新增 `actiNetModels: ProviderModel[]`

### 修改：`src/components/settings/ActiNetSettings.tsx`
- 全面扩展，新增模型管理区域：
  - 模型列表展示、启用/禁用切换按钮
  - 拉取模型列表、手动添加模型、搜索过滤
  - UI 复用 `model-row` + `model-toggle-button` 模式
- 新增 props：`actiNetModels`、`onUpdateActiNetModels`

### 修改：`src/App.tsx`
- 新增常量 `ACTINET_PROVIDER_ID = '__actinet__'`
- 启动 useEffect：`verifyCloudAuth()` → 失败则 `deactivateCloudAuth()`
- `getEnabledModelOptions()`：接受 `actiNetModels` 参数，合并 ActiNet 模型
- `enabledModelsByProvider`：登录状态下自动添加 ActiNet 分组
- `ensureValidCurrentModelSelection()`：处理 ActiNet provider 选中
- `resolveProviderRequestSettings()`：处理 `__actinet__` → 路由到 cloud-server
- `renderActiNetSettings()`：传递模型管理 props
- `DEFAULT_SETTINGS` 新增 `actiNetModels: []`
- 新增 `actinet-notice` 自定义事件监听 → 转发为 `pushNotice`

## Cloud Server 后端变更

### 修改：`cloud-server/src/types.ts`
- `Upstream` 去掉 `priority`、`group_name`，新增 `models: string[]`
- 新增 `ModelPriority` 接口

### 修改：`cloud-server/src/db/migrations.ts`
- 新增 v2 迁移：重建 `upstreams` 表（去掉 priority/group_name，增加 models）；新建 `model_priorities` 表

### 新建：`cloud-server/src/db/repositories/model-priority-repo.ts`
- `ModelPriorityRepo`：CRUD + `listByModel()` + `reorder()`（批量排序）

### 修改：`cloud-server/src/db/repositories/upstream-repo.ts`
- `upstreamFromRow` 解析 `models` JSON 字段
- `listAll()`/`listEnabled()` 去掉 `ORDER BY priority`
- `create()`/`update()` 使用 `models` 替代 `priority`/`group_name`

### 新建：`cloud-server/src/proxy/model-strategy.ts`
- `selectUpstreamForModel(modelName, upstreams, priorities, unhealthySet)`：
  - 有优先级配置 → 按 priority 升序尝试，跳过不健康上游
  - 无配置 → 筛选含该模型的上游 → 按名称字母排序 → 选第一个健康的
- `getAvailableModels()`：所有上游 models 字段去重并集
- 不健康状态全局管理

### 重写：`cloud-server/src/proxy/upstream-selector.ts`
- `selectUpstream(allUpstreams, modelName?, modelPriorities?)`：
  - 有模型名 → 委托给 `selectUpstreamForModel()`
  - 无模型名 → 按名称字母排序选第一个健康上游
- `markUnhealthy`/`markHealthy` 不再需要 priority 参数

### 修改：`cloud-server/src/proxy/proxy-routes.ts`
- `/v1/chat/completions`：提取 `model` 字段 → 查询模型优先级 → 传给选择器
- `/v1/models`：不再透传上游，改为返回 `getAvailableModels()` 结果
- `markUnhealthy` 调用去掉 priority 参数

### 修改：`cloud-server/src/upstream/health-checker.ts`
- 去掉优先级组逻辑（不再有 `priority`、`priority_group`）
- 简化：仅检查不健康上游 → 恢复标记

### 修改：`cloud-server/src/admin/admin-routes.ts`
- 上游管理端点适配新字段（`models` 替代 `priority`/`group_name`）
- 新增模型优先级 CRUD 端点：
  - `GET /api/admin/model-priorities`（支持 `?model=` 筛选）
  - `POST /api/admin/model-priorities`
  - `PUT /api/admin/model-priorities/:id`
  - `DELETE /api/admin/model-priorities/:id`
  - `PUT /api/admin/model-priorities/reorder`

### 修改：`cloud-server/src/app-context.ts`
- `repos` 新增 `modelPriorities: ModelPriorityRepo`

## Admin UI 变更

### 修改：`admin-ui/src/api.ts`
- `UpstreamData` 去掉 `priority`/`group_name`，新增 `models: string[]`
- `createUpstream` 参数更新
- 新增 `ModelPriorityData` 接口
- 新增模型优先级 API 函数：`fetchModelPriorities`、`createModelPriority`、`updateModelPriority`、`deleteModelPriority`、`reorderModelPriorities`

### 修改：`admin-ui/src/pages/UpstreamsPage.tsx`
- 表单：去掉优先级/分组输入，新增「模型列表」输入（逗号分隔）
- 表格列：显示模型列替代优先级和分组列
- 新增「编辑」按钮（通过内联表单编辑）

### 新建：`admin-ui/src/pages/ModelPrioritiesPage.tsx`
- 新页面：按模型分组展示上游优先级排序
- 支持选择模型 → 添加上游 → 上移/下移调整优先级 → 删除
- 空状态提示

### 修改：`admin-ui/src/App.tsx`
- `Page` 类型新增 `'model-priorities'`
- 路由新增 `<ModelPrioritiesPage />`

### 修改：`admin-ui/src/components/Layout.tsx`
- `Page` 类型同步更新
- 导航新增「模型策略」按钮

### 修改：`admin-ui/src/styles/admin.css`
- 新增 `.admin-muted` 样式

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — 前端：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npm run build` — 前端：构建成功（748 KB JS）
- `npm run build` — admin-ui：构建成功（381 KB JS）
- `npm run lint` — 无新增错误（5 个已存在问题）

## 决策关卡

- 方案已提出：是（三轮需求讨论）
- 用户确认已收到：是
- 需求修订：
  - 不需要凭据预填
  - 无模型优先级配置时按上游名字母排序
  - Cloud server 无需向后兼容

## 设计决策

1. **ActiNet 作为虚拟供应商**：使用 `providerId = '__actinet__'` 将 ActiNet 模型合并到模型选择器，数据与普通供应商分离（`settings.actiNetModels`），不污染 `providers` 数组
2. **数据库迁移使用表重建**：DROP/recreate `upstreams` 表（无需向后兼容），新建 `model_priorities` 表
3. **模型策略通过独立 CRUD 端点管理**：不嵌套在上游管理端点中，单独页面操作更清晰

## 已知限制

- ActiNet 模型偏好仅 localStorage 持久化，多设备不同步
- 健康检查间隔保持 10 分钟全局配置
- `distribution_mode`（fill/round_robin）不受影响，仅影响单个上游内部 key 选择
- Admin UI 模型策略页面无拖拽排序（仅上移/下移按钮）

## 下一步

- 在 Android 设备上验证完整流程
- 可选：为模型策略页面添加拖拽排序
- 可选：支持模型提示词覆盖（与普通供应商相同）
