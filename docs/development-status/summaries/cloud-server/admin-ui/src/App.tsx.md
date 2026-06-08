# `cloud-server/admin-ui/src/App.tsx`

## 功能
Admin UI 根组件。包含 `AuthProvider` 上下文、登录状态检测、页面路由（dashboard/upstreams/model-priorities/users/api-keys/software-updates/actistation/settings/logs/health）和条件渲染。未登录时显示 `LoginPage`，登录后通过 `Layout` 包裹对应页面。v16：`Page` 类型改为从 `CommandPalette` 导入（全站共享，避免重复定义漂移）。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/auth-context.ts` — `AuthProvider`、`useAuth`
- `cloud-server/admin-ui/src/components/CommandPalette.tsx` — `Page` 类型
- `cloud-server/admin-ui/src/pages/LoginPage.tsx`
- `cloud-server/admin-ui/src/pages/DashboardPage.tsx`
- `cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`
- `cloud-server/admin-ui/src/pages/ModelPrioritiesPage.tsx`
- `cloud-server/admin-ui/src/pages/UsersPage.tsx`
- `cloud-server/admin-ui/src/pages/ApiKeysPage.tsx`
- `cloud-server/admin-ui/src/pages/SoftwareUpdatesPage.tsx`
- `cloud-server/admin-ui/src/pages/ActiStationPage.tsx`
- `cloud-server/admin-ui/src/pages/SettingsPage.tsx`
- `cloud-server/admin-ui/src/pages/LogsPage.tsx`
- `cloud-server/admin-ui/src/pages/HealthPage.tsx`
- `cloud-server/admin-ui/src/components/Layout.tsx`

### 提供
- `App`（default export）
