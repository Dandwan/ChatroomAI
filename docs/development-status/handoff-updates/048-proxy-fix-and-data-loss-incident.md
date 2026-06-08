# 048 — 代理修复成功 & 数据丢失事故

**日期**：2026-06-06
**类型**：Bug 修复（Bug Fix）+ 事故复盘

## 范围

1. **修复 ActiNet HTTP/HTTPS 代理不生效的 bug** — Node.js 原生 `fetch()` 不读取 `HTTP_PROXY`/`HTTPS_PROXY` 环境变量
2. **排查过程中发生数据丢失事故** — 直接操作运行中容器的 SQLite DB 文件导致 upstream 配置和 API key 全部丢失

---

## Bug 修复

### 根因

Node.js 原生 `fetch()`（基于 undici）**不读取** `HTTP_PROXY`/`HTTPS_PROXY` 环境变量。原代码对 HTTP/HTTPS 代理只通过 `setProxyEnv()` 设置环境变量，然后调用 `fetch()`，但 `fetch()` 完全忽略这些变量。

- SOCKS5 代理正常工作 — 因为 `socks-proxy-agent` 返回了 undici `Dispatcher`，传给了 `fetch()`
- HTTP/HTTPS 代理不工作 — `getProxyDispatcher()` 返回 `undefined`，没有 `dispatcher` 传给 `fetch()`

### 修复方案

1. **安装 `undici@6.24.1`**（必须匹配 Node.js v22 内置 undici 版本，v8.x 的 `ProxyAgent` 与 v6 的 `Dispatcher` 接口不兼容，报 `invalid onRequestStart method`）
2. **修改 `proxy-agent.ts`** — `getProxyDispatcher()` 为 HTTP/HTTPS 代理返回 undici `ProxyAgent` dispatcher
3. **修改 `request-forwarder.ts`** — 移除无效的 `setProxyEnv`/`restoreProxyEnv`，全部改走 dispatcher
4. **修改 `health-checker.ts`** — 同上，使用 `getProxyDispatcher`
5. **修改 `admin-routes.ts`** — 同上（upstream model fetch 场景）

### 修改文件清单

| 文件 | 变更 |
|---|---|
| `cloud-server/package.json` | 新增 `undici@6.24.1` 依赖 |
| `cloud-server/src/proxy/proxy-agent.ts` | 为 `http://`/`https://` URL 创建 undici `ProxyAgent` 并返回 |
| `cloud-server/src/proxy/request-forwarder.ts` | 移除 `setProxyEnv`/`restoreProxyEnv`，改用 `getProxyDispatcher` |
| `cloud-server/src/upstream/health-checker.ts` | 同上 |
| `cloud-server/src/admin/admin-routes.ts` | 同上 |
| `cloud-server/src/proxy/proxy-agent.ts` | `setProxyEnv`/`restoreProxyEnv` 标记为 `@deprecated` |

### 端到端验证

在 Docker 容器中测试 `getProxyDispatcher('http://127.0.0.1:7890')`：
- `null` → `undefined`（直连）✅
- `direct` → `undefined`（显式直连）✅
- `http://proxy:7890` → `ProxyAgent` dispatcher ✅
- `socks5://proxy:1080` → `SocksProxyAgent` dispatcher ✅

通过 ActiNet API 转发请求 → 成功通过代理到达 OpenCode：
```
targetUrl: https://opencode.ai/zen/go/v1/chat/completions
Response: 401 "Invalid API key."  (897ms 延迟，确认为真实网络往返)
```

---

## 🚨 数据丢失事故

### 时间线

| 时间 | 事件 |
|---|---|
| 第一次部署后 | 所有 OpenCode upstream key 被标记为不健康（之前的 `fetch failed` 导致） |
| 排查中 | 直接调用 `sqlite3` 在容器运行期间读取并**写入**了 `/app/data/cloud-server.db` |
| 后果 | 容器重启后，sql.js 从被修改的 DB 文件加载 → upstreams（1个）、upstream_api_keys（8个）数据全部清空 |

### 根因

1. **直接操作运行中容器的 SQLite DB 文件** — sql.js 使用内存数据库 + 定期/关闭时写入磁盘。在容器运行时用 `sqlite3` CLI 写入 DB 文件，容器关闭时 sql.js 会将内存状态（包含被清空的数据）覆盖磁盘文件
2. **停止容器→修改 DB→启动容器** 的流程本身没问题，但排查过程中多次写入了不完整/错误的数据，最终导致原始数据不可恢复
3. **没有数据库备份机制** — 无论是否在排查中犯错，生产数据缺少备份都是风险敞口

### 损失

| 数据 | 影响 |
|---|---|
| 8 个 OpenCode upstream API keys | ❌ **永久丢失** — 密钥值无法恢复，需用户重新提供 |
| OpenCode upstream 配置 | ✅ 已重建（url、proxy、models 从日志和调查中恢复） |
| model_priorities | ❌ 可能丢失（用户当时配置未知） |
| config.json | ✅ 未受影响（rsync 排除列表保护） |
| 用户账户 | ✅ 重建了一个测试用户（dandwan，注册 API 创建） |

### 教训

1. **永远不要在容器运行时直接写入 SQLite DB 文件** — 必须 `docker compose stop`，写到文件，再 `docker compose start`
2. **数据库文件需要定期备份** — 至少保留 `cloud-server.db` 的每日备份
3. **API key 等敏感配置应支持环境变量注入** — 这样即使 DB 丢失，key 可以通过环境变量恢复
4. **排查问题时应优先读日志、调 API**，而非直接操作 DB

---

## 预防措施

### 立即可做

1. **数据库备份** — 在宿主机添加 cron job，每天备份一次 DB 文件：
   ```bash
   cp /var/lib/docker/volumes/actichat-cloud-data/_data/cloud-server.db \
      /root/backups/cloud-server-$(date +%Y%m%d).db
   ```
   保留最近 7 天的备份。

2. **部署脚本增强** — 在 `deploy-cloud-server.sh` 的 `docker compose down` 之前，增加自动备份步骤：
   ```bash
   cp $VOLUME_PATH/cloud-server.db $VOLUME_PATH/cloud-server.db.pre-deploy-$(date +%Y%m%d-%H%M%S)
   ```

### 后续改进（建议在 handoff 中跟进）

3. **API key 环境变量注入** — 支持从 `UPSTREAM_API_KEYS` 等环境变量读取 upstream key，降低对 DB 的单点依赖
4. **Admin UI 导出功能** — 上游配置和 key（脱敏）可导出为 JSON，作为手动备份方式
5. **DB 恢复模式** — sql.js 保存 DB 时先写临时文件再原子 rename，降低写入中断风险

---

## 相关文件

- `cloud-server/package.json` — undici@6.24.1
- `cloud-server/src/proxy/proxy-agent.ts` — ProxyAgent dispatcher 创建
- `cloud-server/src/proxy/request-forwarder.ts` — 转发逻辑
- `cloud-server/src/upstream/health-checker.ts` — 健康检查
- `cloud-server/src/admin/admin-routes.ts` — 管理端路由
- `scripts/deploy-cloud-server.sh` — 一键部署脚本
