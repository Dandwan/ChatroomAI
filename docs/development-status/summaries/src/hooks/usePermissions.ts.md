# `src/hooks/usePermissions.ts`

## 功能
权限管理 hook。管理原生权限请求（位置、相机、麦克风、通知）。提取自 `src/App.tsx`。

## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — `useUIStore`（管理 `requestingPermissionByKey` 状态）
- `src/state/settings-store.ts` — `useSettingsStore`（更新 `permissionToggles`）
- `src/utils/app-module.ts` — `requestLocationPermission`, `requestMediaPermission`, `requestNotificationPermission`, `ensureValidCurrentModelSelection`
- `src/state/types.ts` — `PERMISSION_LABELS`, `AppPermissionKey`

### 提供
- `usePermissions` — 返回 `requestingPermissionByKey` 状态和 `handlePermissionToggle` 回调

### 被依赖
- `src/App.tsx` — 使用 hook 替代内联代码

## 关键词
### 函数
- `usePermissions` — hook 主函数
- `handlePermissionToggle` — 权限开关（请求原生权限 + 更新设置）
