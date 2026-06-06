# `cloud-server/docker-compose.yml`

## 功能
Docker Compose 部署配置。定义 cloud-server 服务的构建、运行和持久化方式。服务使用多阶段 Dockerfile 构建，`network_mode: host` 直接使用宿主机网络（2178 端口），外部 Docker volume `actichat-cloud-data` 挂载到 `/app/data` 持久化数据库和配置文件。**v2: 所有 `CLOUD_SERVER_*` 环境变量已迁移至 `data/config.json`（Docker volume 持久化），容器不再注入任何 CLOUD_SERVER_* 环境变量。** 配置修改通过 Admin UI 或直接编辑 config.json 完成。

## 关系
### 引用
- `cloud-server/Dockerfile` — 构建上下文

### 被依赖
- `scripts/deploy-cloud-server.sh` — 一键部署脚本
