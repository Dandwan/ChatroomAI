# `cloud-server/admin-ui/src/pages/UsersPage.tsx`

## 功能
Admin 用户管理页面。显示所有用户列表，支持按状态分组筛选（全部/已启用/未启用/未验证）。表格列包含用户名、邮箱、API Key、RPM/TPD 限制、状态、创建时间、操作。已启用/未启用用户可在状态列中切换，未验证用户显示「未验证」标签。支持删除用户。

**v1 初始版本：分组筛选 + 未验证状态显示。v16：加载态改为 `SkeletonTable` 骨架屏，新增页面副标题。**

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchUsers`, `updateUser`, `deleteUser`, `UserData`
- `cloud-server/admin-ui/src/components/Skeleton.tsx` — `SkeletonTable`
- `react` — `useState`, `useEffect`, `useMemo`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx` （路由）

## 关键词
### 函数
- `UsersPage` — 组件
- `filterUsers` — 客户端筛选逻辑

### 类型
- `FilterKey` — `'all' | 'enabled' | 'disabled' | 'unverified'`
- `FilterTab` — `{ key, label }`
