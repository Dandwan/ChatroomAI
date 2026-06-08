# `cloud-server/admin-ui/src/pages/SoftwareUpdatesPage.tsx`

## 功能
软件更新页面。Android APK 版本发布与灰度推送管理：新建版本（版本名/code/更新说明/发布模式/灰度百分比/指标规则/APK 上传）、版本列表表格（含增量补丁、下载数、启用切换、全量推送、删除）。v16：加载态改为 `SkeletonTable` 骨架屏 + 页面副标题。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchSoftwareUpdates` / `createSoftwareUpdate` / `uploadApkForUpdate` / `updateSoftwareUpdate` / `deleteSoftwareUpdate` / `rolloutSoftwareUpdate`
- `cloud-server/admin-ui/src/components/Skeleton.tsx` — `SkeletonTable`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`

## 关键词
### 函数
- `SoftwareUpdatesPage`
