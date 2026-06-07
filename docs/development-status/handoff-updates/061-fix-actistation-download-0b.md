# 061 — 修复 ActiStation 下载 0B 空文件

**日期**：2026-06-08

## 问题

用户在 ActiStation 展示网站点击下载按钮后，浏览器下载 0B 空文件（实际文件 215MB）。

## 根因

两个同时存在的问题导致：

1. **nginx `proxy_buffering` 默认开启**（端口 2179 配置）：nginx 在接收到上游的完整响应前不向客户端发送任何数据。对于 215MB APK 文件，缓冲阶段浏览器收不到任何数据，导致显示 0B 或超时。

2. **Express 下载路由缺少 `Content-Length` 头**：`update-routes.ts` 使用 `createReadStream().pipe(res)` 流式传输，但未设置 `Content-Length` 响应头。浏览器无法知道文件总大小，无法显示下载进度。

## 修复

| 文件 | 变更 |
|------|------|
| `cloud-server/src/update/update-routes.ts` | 在下载响应中添加 `Content-Length` 头（从 `update.apk_size_bytes` / `update.patch_size_bytes` 读取） |
| 服务器 `/etc/nginx/conf.d/actichat-cloud-2179.conf` | `location /` 块中添加 `proxy_buffering off;`，使大文件响应直接流式传输而不经过 nginx 缓冲区 |

## 验证

- ✅ `Content-Length: 215891432` 头正确返回
- ✅ 下载从外部立刻开始流式传输（10 秒内获取 71MB）
- ✅ nginx 语法检查通过、配置热重载成功
- ✅ Docker 镜像重建并重启成功

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是
- 根因清晰：nginx 响应缓冲 + 缺失 Content-Length

## 下一步

- 无
