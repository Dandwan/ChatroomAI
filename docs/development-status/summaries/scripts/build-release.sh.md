# scripts/build-release.sh

## 功能

Release APK 一键构建脚本。与 `build.sh` 逻辑对等，但构建目标为 release variant。同步 union-search skill → 打包 Node.js/Python 运行时 → 构建 Android release APK。

支持环境变量：
- `SKIP_RUNTIME_PACKAGE=true` — 跳过运行时打包（使用已有缓存）
- `BUILD_OFFLINE=true` — 离线模式，使用缓存的运行时包

## 关系

### 调用 / 引用
- `npm run skill:sync:union-search` — 同步 union-search skill
- `npm run runtime:package:node` — 打包 Node.js 运行时
- `npm run runtime:package:python` — 打包 Python 运行时
- `npm run android:build:release` — 构建 release APK

### 被依赖
- 开发者手动执行
- `scripts/build-and-install-release.sh` — 共享产物路径
