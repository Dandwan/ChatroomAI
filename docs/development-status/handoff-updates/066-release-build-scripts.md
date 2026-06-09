# 066 — 添加 Release 版一键构建脚本

**日期**：2026-06-09

## 范围

新增两个 release variant 的一键构建脚本，与现有 debug 脚本逻辑对等，仅构建目标从 `assembleDebug` 切换为 `assembleRelease`。

## 变更的代码区域

### 新增：`scripts/build-release.sh`
- 基于 `build.sh`，构建目标改为 `npm run android:build:release`
- APK 产物路径：`android/app/build/outputs/apk/release/app-release.apk`

### 新增：`scripts/build-and-install-release.sh`
- 基于 `build-and-install.sh`，构建目标改为 `npm run android:build:release`
- 构建完成后自动检测设备并安装 release APK

### 代码摘要
- 新增：`scripts/build-release.sh.md`
- 新增：`scripts/build-and-install-release.sh.md`
- 补充：`scripts/build.sh.md`（原有脚本缺失摘要，一并补齐）
- 补充：`scripts/build-and-install.sh.md`

## 决策关卡

- 方案已提出：是
- 用户确认：是

## 验证

- 脚本为 bash 脚本，语法与现有 `build.sh` / `build-and-install.sh` 一致
- 未实际执行 release 构建（需签名配置）

## 下一步

- 如需实际构建 release APK，确保 `android/app/build.gradle` 中 signingConfig 已配置
