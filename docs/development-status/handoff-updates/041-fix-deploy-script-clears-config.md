# 041 — 修复云服务配置在更新时被清空

**日期**：2026-06-06

## 范围

修复云服务配置（`config.json`）在部署/更新/容器重建时被清空的问题。该问题导致通过 Admin UI 设置的所有配置（SMTP、邮件服务器模式、DKIM、TLS、站点 URL、模型映射、代理 URL、email 冷却时间等）丢失。

## 根因

两个相互独立的问题导致配置丢失：

1. **部署脚本 `rsync --delete`**：`scripts/deploy-cloud-server.sh` 的 rsync 排除列表遗漏 `config.json`，本地开发环境通常没有此文件，导致远程服务器上的 `config.json` 被删除。

2. **配置存储位置不在 Docker 持久化卷内**（根本原因）：`config.json` 存储在 `/app/config.json`（容器内部文件系统），而 Docker volume 只挂载了 `/app/data/`。`docker compose up -d --build` 重建容器时，旧容器被销毁，`/app/config.json` 随之丢失。**无论通过何种方式更新（部署脚本、手动 docker compose、直接 rsync），只要容器重建配置就丢失。**

## 变更的代码区域

### 修改：`cloud-server/src/config.ts`
- `loadJsonConfig()`：配置路径 `resolve(projectRoot, 'config.json')` → `resolve(projectRoot, 'data', 'config.json')`

### 修改：`cloud-server/src/admin/admin-routes.ts`
- 配置持久化路径：`resolve(projectRoot, 'config.json')` → `resolve(projectRoot, 'data', 'config.json')`

### 修改：`cloud-server/src/watcher/config-watcher.ts`
- 文件监听路径：`resolve(projectRoot, 'config.json')` → `resolve(projectRoot, 'data', 'config.json')`

### 修改：`scripts/deploy-cloud-server.sh`
- rsync 排除列表新增 `--exclude='config.json'`（双重保护，`data/` 本已排除）

### 代码摘要
- 更新：`cloud-server/src/config.ts.md`
- 更新：`cloud-server/src/admin/admin-routes.ts.md`
- 更新：`cloud-server/src/watcher/config-watcher.ts.md`
- 新建：`scripts/deploy-cloud-server.sh.md`

## 为什么这样修复

- `data/` 目录已被 Docker volume `actichat-cloud-data` 挂载到 `/app/data`，内容跨容器重建持久存在
- `data/` 已被 rsync 排除列表保护（`--exclude='data'`），不会被部署脚本删除
- `config.json` 现在与数据库文件 `cloud-server.db` 处于同一持久化目录，架构一致
- 无需改动 `docker-compose.yml` 或 `Dockerfile`

## 决策关卡

- 用户明确无需向后兼容（项目未上线），直接修改路径即可。

## 验证

- `npx tsc --noEmit`（cloud-server）：**零错误**
- 路径一致性验证：三个文件中的 configPath 指向同一个位置 `data/config.json`

## 已知限制

- `.env` 文件未在 rsync 排除列表中，远程如有本地修改可能被覆盖。当前 `.env.production` 已纳入版本控制，暂不成问题。
- 远程服务器首次启动时 `data/config.json` 不存在，服务器使用默认值运行，Admin UI 首次保存设置时会自动创建。

## 下一步

- 部署后通过 Admin UI 修改设置，然后执行 `docker compose down && docker compose up -d --build`，验证设置是否保留。
