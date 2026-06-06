# 056 — 上游超时可配置 + 设置页改造 + 环境变量迁移至 config.json

**日期**：2026-06-07
**类型**：新增功能 + 重构

## 问题描述

1. Claude Code 通过 ActiNet 连接 DeepSeek V4 Pro 时任务中断 — 根因是 `request-forwarder.ts` 硬编码 `AbortSignal.timeout(15_000)`（15秒），推理模型生成 reasoning 超时被 abort，且 SSE headers 已发送无法重试
2. Admin UI 设置页"服务器信息（只读）"一栏的 port/logLevel/healthCheckIntervalMs 无法通过 UI 修改
3. Docker 容器通过环境变量注入所有配置，管理分散

## 变更范围

### 新增功能：upstreamTimeoutMs 全局可配置

| 文件 | 变更 |
|------|------|
| `cloud-server/src/config.ts` | ServerConfig 新增 `upstreamTimeoutMs: number`（默认 300_000），支持 `CLOUD_SERVER_UPSTREAM_TIMEOUT_MS` 环境变量和热重载 |
| `cloud-server/src/proxy/request-forwarder.ts` | `StreamForwardOptions` 新增 `timeoutMs?: number`；`forwardNonStreamRequest()` 新增 `timeoutMs?: number` 参数；替换硬编码 `15_000` → `options.timeoutMs ?? 300_000` |
| `cloud-server/src/proxy/proxy-routes.ts` | 调用 forward 函数时传入 `ctx.config.upstreamTimeoutMs` |
| `cloud-server/src/admin/admin-routes.ts` | GET/PUT /settings 新增 `upstreamTimeoutMs` 字段（验证 >=1000） |
| `cloud-server/admin-ui/src/pages/SettingsPage.tsx` | 代理转发卡片新增上游超时输入（秒为单位，默认 300） |
| `cloud-server/admin-ui/src/api.ts` | `ServerSettings` 新增 `upstreamTimeoutMs`；`updateSettings()` 参数新增 `upstreamTimeoutMs?` |

### 重构：Admin UI 设置页改造

| 变更 | 说明 |
|------|------|
| 删除"服务器信息（只读）"卡片 | port/logLevel/healthCheckIntervalMs 不再只读展示 |
| 新增"服务器运行参数"卡片 | port（需重启）、logLevel（下拉，热重载）、healthCheckIntervalMs（秒，热重载）全部可编辑 |
| 代理转发卡片 | 新增 upstreamTimeoutMs 输入 |

### 重构：环境变量迁移至 config.json

| 文件 | 变更 |
|------|------|
| `cloud-server/docker-compose.yml` | 移除所有 `CLOUD_SERVER_*` environment 变量和 `env_file` |
| `cloud-server/Dockerfile` | 移除所有 `CLOUD_SERVER_*` ENV 指令，仅保留 `NODE_ENV=production` |
| 服务器 `data/config.json` | 写入完整配置（port/dbPath/jwtSecret/adminUsername/adminPassword/logLevel/healthCheckIntervalMs/upstreamTimeoutMs…） |

## 设计决策

1. **超时默认 5 分钟**：覆盖 DeepSeek V4 Pro 等推理模型的长 reasoning 时间。用户可通过 Admin UI 调整
2. **upstreamTimeoutMs 支持热重载**：与现有 logLevel/healthCheckIntervalMs 模式一致
3. **port 标注"需重启"**：Express 已监听端口，config.json 变更后需手动 `docker compose restart`
4. **环境变量优先级保留**：`loadConfig()` 仍支持 `CLOUD_SERVER_*` 环境变量覆盖，但容器不再注入。用户如需临时覆盖仍可手动设置
5. **config.json 持久化保证**：Docker volume `actichat-cloud-data` 持久化，deploy 脚本排除 `data/` 和 `config.json` 防止覆盖

## 验证

- [x] `npx tsc --noEmit` — cloud-server：零错误
- [x] `npx tsc --noEmit` — admin-ui：零错误
- [x] `npx vite build` — admin-ui 构建成功（419KB JS）
- [x] Docker 构建 + 一键部署到 dandwan.site
- [x] 服务器正确读取 config.json（port: 2178, upstreamTimeoutMs: 300000）
- [x] GET /api/admin/settings 返回完整配置（含 upstreamTimeoutMs）
- [ ] Admin UI 手动测试设置保存（待用户在浏览器验证）

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是
- 用户需求修正：
  1. 默认超时 5 分钟 — 确认
  2. 服务器信息（只读）一栏去掉，改为可设置 — 确认
  3. 去除容器环境变量，统一 config 方式 — 确认
  4. port 需重启生效，logLevel/healthCheckIntervalMs 支持热重载 — 确认

## 下一步

- 用户在浏览器访问 Admin UI 验证新设置页
- 测试 upstreamTimeoutMs 修改后是否对新请求生效
- 观察是否有超时相关错误减少
