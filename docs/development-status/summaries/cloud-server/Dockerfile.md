# `cloud-server/Dockerfile`

## 功能
多阶段 Docker 构建文件。Stage 1（admin-builder）：在 `node:22-alpine` 中构建 Admin UI（`tsc -b && vite build`）。Stage 2：Node.js 22 Alpine 运行环境，拷贝服务端源码和编译后的 Admin UI，通过 `tsx` 运行时执行 TypeScript 源码。**v2: 移除所有 `CLOUD_SERVER_*` ENV 指令（port/dbPath/logLevel/healthCheckIntervalMs），仅保留 `NODE_ENV=production`。配置统一从 `data/config.json`（Docker volume）读取。**

## 关系
### 引用
- `cloud-server/package.json`
- `cloud-server/tsconfig.json`
- `cloud-server/src/` — 服务端源码
- `cloud-server/admin-ui/` — Admin UI 源码

### 被依赖
- `cloud-server/docker-compose.yml`
