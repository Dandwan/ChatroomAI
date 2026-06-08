# `cloud-server/admin-ui/src/components/Skeleton.tsx`

## 功能
骨架屏占位组件（v16 新增）。替换页面加载态的"加载中…"文字。`SkeletonTable` 渲染表格行 shimmer 占位，`SkeletonStats` 渲染统计卡 shimmer 占位。样式由 admin.css 的 `.admin-skeleton`/`.admin-sk-row` 提供。

## 关系
### 提供
- `SkeletonTable` — 表格骨架屏（props: rows / cols）
- `SkeletonStats` — 统计卡骨架屏（props: count）

### 被依赖
- `cloud-server/admin-ui/src/pages/DashboardPage.tsx`
- `cloud-server/admin-ui/src/pages/UsersPage.tsx`
- `cloud-server/admin-ui/src/pages/ApiKeysPage.tsx`
- `cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`
- `cloud-server/admin-ui/src/pages/ModelPrioritiesPage.tsx`
- `cloud-server/admin-ui/src/pages/SoftwareUpdatesPage.tsx`
- `cloud-server/admin-ui/src/pages/SettingsPage.tsx`

## 关键词
### 函数
- `SkeletonTable`
- `SkeletonStats`
