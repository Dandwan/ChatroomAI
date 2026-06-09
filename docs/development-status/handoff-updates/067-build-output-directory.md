# 067 — 统一构建产物输出目录

**日期**：2026-06-09

## 范围

将构建产物 APK 从深层 Gradle 路径 (`android/app/build/outputs/apk/{debug,release}/`) 统一复制到项目根目录 `build-output/`，方便查找和分发。

## 变更的代码区域

### 修改：4 个构建脚本
- `scripts/build.sh` — 构建后 cp 到 `build-output/ActiChat-debug.apk`
- `scripts/build-and-install.sh` — 同上，install 改用 `build-output/` 路径
- `scripts/build-release.sh` — 构建后 cp 到 `build-output/ActiChat-release.apk`
- `scripts/build-and-install-release.sh` — 同上

### 修改：`scripts/serve-debug-apk.sh`
- 共享目录从 `android/app/build/outputs/apk/debug` 改为 `build-output/`

### 修改：`.gitignore`
- 添加 `build-output/`

### 修改：`docs/development-status/30-current-state-and-known-issues.md`
- 更新构建产物路径说明

### 代码摘要
- 更新：`scripts/build.sh.md`、`scripts/build-and-install.sh.md`、`scripts/build-release.sh.md`、`scripts/build-and-install-release.sh.md`
- 新增：`scripts/serve-debug-apk.sh.md`

## 决策关卡

- 方案已提出：是
- 用户确认：是

## 验证

- Shell 语法审查通过
- 未实际执行构建验证（无 Android 构建环境）

## 下一步

- 执行一次 `bash scripts/build.sh` 验证 `build-output/ActiChat-debug.apk` 正常生成
