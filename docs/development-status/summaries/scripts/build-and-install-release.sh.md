# scripts/build-and-install-release.sh

## 功能

Release APK 一键构建并安装脚本。在 `build-release.sh` 的基础上增加 `adb install` 步骤：构建完成后复制到 `build-output/ActiChat-release.apk`，自动检测设备并安装。

支持环境变量：
- `SKIP_RUNTIME_PACKAGE=true` — 跳过运行时打包
- `BUILD_OFFLINE=true` — 离线模式

## 关系

### 调用 / 引用
- `npm run skill:sync:union-search` — 同步 union-search skill
- `npm run runtime:package:node` — 打包 Node.js 运行时
- `npm run runtime:package:python` — 打包 Python 运行时
- `npm run android:build:release` — 构建 release APK
- `adb` — 设备检测与 APK 安装

### 被依赖
- 开发者手动执行
