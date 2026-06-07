# `cloud-server/src/update/update-routes.ts`

## 功能
客户端软件更新公开 API。`GET /api/updates/check` 根据客户端版本号查找可用更新（含灰度判定逻辑）；`GET /api/updates/download/:id` 流式下载 APK 或增量补丁文件并计数下载。下载响应包含 `Content-Length` 头，确保浏览器能正确显示文件大小和下载进度。

## 关系
### 调用 / 引用
- `cloud-server/src/app-context.ts` — `AppContext`
- `cloud-server/src/logger.ts` — `createLogger`
- `node:fs`、`node:path` — 文件流式传输

### 提供
- `createUpdateRoutes(ctx)` — Express Router

### 被依赖
- `cloud-server/src/app.ts` — 挂载路由
- `website/actistation.js` — ActiStation 网站通过此 API 获取 APK 下载链接

### 关联配置
- 服务器 nginx `/etc/nginx/conf.d/actichat-cloud-2179.conf` — 需设置 `proxy_buffering off;` 确保大文件流式传输不被 nginx 缓冲
