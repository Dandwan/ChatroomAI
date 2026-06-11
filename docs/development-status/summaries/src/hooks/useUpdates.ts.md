# `src/hooks/useUpdates.ts`

## 功能
软件更新管理 hook。管理 APK 更新检查、下载和安装逻辑。提取自 `src/App.tsx`。

## 关系
### 调用 / 引用
- `src/services/app-update.ts` — `checkForUpdate`, `UpdateInfo` 类型
- `src/services/cloud-auth.ts` — `isCloudLoggedIn`, `getCloudServerUrl`

### 提供
- `useUpdates` — 返回 `pendingUpdate`, `showUpdateDialog`, `updatingNow` 状态和 `handleInstallUpdate`, `handleManualUpdateCheck`, `onUpdateFound`, `dismissUpdateDialog` 回调

### 被依赖
- `src/App.tsx` — 使用 hook 替代内联代码

## 关键词
### 函数
- `useUpdates` — hook 主函数
- `handleInstallUpdate` — APK 安装（原生路径或浏览器下载）
- `handleManualUpdateCheck` — 手动检查更新
- `onUpdateFound` — 更新发现回调（供 useCloudAuth）
- `dismissUpdateDialog` — 关闭更新对话框
