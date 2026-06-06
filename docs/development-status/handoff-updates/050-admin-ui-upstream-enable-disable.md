# 050 — Admin UI 上游启用/禁用切换

**日期**：2026-06-07
**类型**：新增功能（New Feature）

## 范围

在 ActiNet Admin UI 的上游管理页面添加启用/禁用上游的切换功能。后端数据模型和 API 已完全支持 `enabled` 字段，本次变更仅添加前端 UI 控件。

## 变更的代码区域

### 修改：`cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`（~20 行新增）

- 新增 `togglingId` state — 追踪正在切换的上游 ID，操作中显示 "…" 禁用态
- 新增 `handleToggleEnabled(upstream)` 函数 — 调用 `updateUpstream(id, { enabled: 0|1 })` 切换启用/禁用状态，成功后刷新列表
- 表格新增「状态」列（位于「模式」和「Keys」之间）— 启用显示绿色「启用」徽章，禁用显示灰色「禁用」徽章
- 操作列新增启用/禁用切换按钮 — 启用状态显示「禁用」按钮（warn 色），禁用状态显示「启用」按钮（success 色）

### 修改：`cloud-server/admin-ui/src/styles/admin.css`（~6 行新增）

- 新增 `.admin-badge-disabled` — 灰色禁用状态徽章（`rgba(156, 163, 175, ...)` 色系）

### 更新：代码摘要（2 个文件）

- `UpstreamsPage.tsx.md` — 新增 v15 启用/禁用切换功能描述
- `admin.css.md` — 新增 v15 `.admin-badge-disabled` 样式描述

## 设计决策

1. **复用现有 API**：`PUT /api/admin/upstreams/:id` 已支持 `enabled` 字段，无需新增后端端点
2. **按钮颜色语义**：启用中的上游显示 warn（橙黄）色「禁用」按钮（警示操作），禁用中的上游显示 success（绿）色「启用」按钮（恢复操作）
3. **操作中禁用态**：切换过程中按钮显示 "…" 并 disabled，防止重复点击
4. **切换后全量刷新**：与现有编辑/删除操作一致，调用 `load()` 全量刷新列表确保一致性

## 验证

- [x] `npx tsc --noEmit` — cloud-server：零错误
- [x] `npx tsc --noEmit` — admin-ui：零错误
- [x] `npx vite build` — admin-ui：构建成功（414 KB JS, 9.5 KB CSS）
- [ ] 部署到 `dandwan.site` 验证启用/禁用切换功能
- [ ] 验证禁用上游后代理请求不再路由到该上游

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是（2026-06-07）

## 已知限制

- 禁用上游不会自动触发即时健康检测（与手动标记 key unhealthy 不同），因为上游级禁用是管理员主动管理操作
- 禁用上游的 Key 健康状态保持不变（不会自动标记为 unhealthy）

## 下一步

- 部署 Docker 镜像到 `dandwan.site` 验证
- 可选：在上游创建/编辑表单中添加启用开关（当前仅在表格行中提供切换）
