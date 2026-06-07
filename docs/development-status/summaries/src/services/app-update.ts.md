# `src/services/app-update.ts`

## 功能
ActiChat 客户端软件更新服务。`checkForUpdate()` 向 ActiNet 服务器查询是否有可用更新；`downloadUpdate()` 流式下载 APK 或增量补丁并报告进度；`dismissUpdate()` / `isUpdateDismissed()` 管理本地弹窗去重（同版本拒绝后不再自动弹窗）。

## 关系
### 调用 / 引用
- `src/utils/app-version.ts` — `getAppVersion`
- `src/services/cloud-auth.ts` — `getCloudServerUrl`

### 提供
- `checkForUpdate`、`downloadUpdate`
- `dismissUpdate`、`isUpdateDismissed`
- `UpdateInfo` 接口、`CheckResult` 接口

### 被依赖
- `src/App.tsx`
- `src/components/UpdateDialog.tsx`
