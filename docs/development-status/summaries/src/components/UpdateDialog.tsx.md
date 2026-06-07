# `src/components/UpdateDialog.tsx`

## 功能
软件更新提醒弹窗组件。复用 `delete-dialog-overlay` + `frosted-surface` 样式与 DeleteConfirmDialog 一致。包含两个阶段：确认阶段（显示新版本号、更新说明、文件大小）→ 用户点击「立即更新」→ 下载阶段（进度条 + 实时下载量 + 百分比）。下载完成后调用 `onInstall` 触发系统安装。

## 关系
### 调用 / 引用
- `src/services/app-update.ts` — `downloadUpdate`、`dismissUpdate`、`UpdateInfo`
- `src/services/cloud-auth.ts` — `getCloudServerUrl`
- `src/utils/app-version.ts` — `versionCodeToName`

### 提供
- `UpdateDialog` — React 组件（default export）

### 被依赖
- `src/App.tsx`
