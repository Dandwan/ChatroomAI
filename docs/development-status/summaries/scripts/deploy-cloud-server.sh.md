# `scripts/deploy-cloud-server.sh`

## 功能
一键部署 ActiNet Cloud Server 到 `dandwan.site` 的 shell 脚本。流程分三步：检查 SSH 连接 → rsync 同步代码（排除 `node_modules/`、`dist/`、`data/`、`admin-ui/dist/`、`admin-ui/node_modules/`、`admin-ui/tsconfig.tsbuildinfo`、`config.json`）→ 远程执行 `docker compose down && docker compose up -d --build` 重建并重启容器。支持 `--dry-run`（仅预览变更）、`--no-build`（仅同步不重建）。

## 关系
### 调用 / 引用
- `cloud-server/` — 部署源目录
- `cloud-server/docker-compose.yml` — Docker 编排
- `cloud-server/Dockerfile` — 容器构建

### 被依赖
（无——由开发者手动调用）
