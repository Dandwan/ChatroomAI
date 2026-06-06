# `cloud-server/admin-ui/src/pages/HealthPage.tsx`

## 功能
Key 健康状态监控页面。展示总 Key 数/健康数/不健康数统计卡片，按上游分组列出每个 Key 的 ID、标签和健康状态（绿色"健康" / 红色"不健康"徽章）。每 30 秒自动刷新。

**v14**: 支持手动修改健康标记 — 每个 Key 行有切换按钮、每个上游分组有批量操作按钮、全局批量操作栏（全部标记健康/不健康）。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchHealthKeys`、`updateKeyHealth`、`batchUpdateKeyHealth`、`KeyHealthEntry`

### 提供
- `HealthPage()` — default export

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`
