# scripts/serve-debug-apk.sh

## 功能

通过 Python HTTP server 在局域网共享 `build-output/` 目录下的构建产物。监听端口可配置（默认 8000），启动时显示局域网 IP 和访问 URL。

## 关系

### 引用
- `build-output/` — 共享的构建产物目录
- `python3 -m http.server` — HTTP 服务器

### 被依赖
- 开发者手动执行（构建后 LAN 分享 APK 给其他设备下载）
