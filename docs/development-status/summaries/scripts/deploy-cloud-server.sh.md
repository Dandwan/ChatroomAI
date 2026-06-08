# `scripts/deploy-cloud-server.sh`

## 功能
一键部署 ActiNet Cloud Server 到 `dandwan.site` 的 shell 脚本。流程分三步：
1. 检查 SSH 连接
2. rsync 同步代码（排除 `node_modules/`、`dist/`、`data/`、`admin-ui/dist/`、`admin-ui/node_modules/`、`admin-ui/tsconfig.tsbuildinfo`、`config.json`）
3. 远程执行 Docker 重建：
   - `docker compose build`（独立构建，失败不影响旧服务）
   - `docker compose down`（仅构建成功后停止旧容器）
   - `docker compose up -d`（启动新容器）
   - 健康检查：等待新容器进入 running 状态

支持 `--dry-run`（仅预览变更）、`--no-build`（仅同步不重建）。

## 关系
### 调用 / 引用
- `cloud-server/` — 部署源目录
- `cloud-server/docker-compose.yml` — Docker 编排
- `cloud-server/Dockerfile` — 容器构建

### 被依赖
（无——由开发者手动调用）

## 关键变更历史
- 064：构建与切换解耦 — `build` 独立执行，失败不影响旧服务
- 041：rsync 排除列表新增 `config.json`，防止配置被清空
