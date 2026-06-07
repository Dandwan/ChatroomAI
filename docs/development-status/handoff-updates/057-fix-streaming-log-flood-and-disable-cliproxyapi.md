# 057 — 修复流式日志洪水 + 永久禁用 cli-proxy-api

**日期**：2026-06-07
**类型**：Bug fix（小修复 — 单文件4行 + 服务器运维操作）

## 问题描述

服务器 dandwan.site 于 2026-06-07 17:09 CST 因内存耗尽卡死，持续约 2.5 小时无响应后手动重启。排查发现两个独立根因叠加导致。

## 根因分析

### 根因 1：ActiNet 代理层流式日志洪水

**位置**：`format-converter.ts` SSE 流式事件循环内

在 `createOpenaiToAnthropicStreamTransformer()` 的 `transform()` 函数中，4 处日志使用了 `log.info()` 而非 `log.debug()`：

| 行号 | 日志消息 | 触发频率 |
|------|---------|---------|
| 1293 | `'OpenAI delta chunk'` | **每个 token delta chunk**（数千次/请求） |
| 1358 | `'[DEBUG] Tool call delta'` | **每个 tool call chunk** |
| 1172 | `'Tool call arguments assembled'` | 每个 tool call 完成 |
| 1469 | `'Text content_block_start'` | 每个 content block 开始 |

生产环境 `logLevel=info`（默认），每个 AI 对话回复产生数千行日志。Docker 捕获所有 stdout 输出，日志缓冲区无限增长，最终耗尽系统 1.6GB 内存。

Docker 容器重启后 3 分钟内产生了 30.6 万行日志（其中 24.2 万行为 WARN/ERROR），验证了日志洪水的严重性。

这与 022 交接更新中明确的设计决策相悖："流式 hot path 不打 chunk 级日志"。

### 根因 2：cli-proxy-api Token Refresh 风暴

cli-proxy-api（Go 编译的独立服务，非本仓库代码）在中国网络环境下尝试刷新 OpenAI token 时被 403 "unsupported_country_region_territory" 拒绝，内置重试机制（3 次/attempt）导致近 2 个月内累积 16.7 万次失败日志。

## 修复内容

### 修改 A：降级流式 hot path 日志（`format-converter.ts` 4 行）

将 4 处 `log.info()` 改为 `log.debug()`：

```diff
- log.info('OpenAI delta chunk', {
+ log.debug('OpenAI delta chunk', {

- log.info('[DEBUG] Tool call delta', {
+ log.debug('[DEBUG] Tool call delta', {

- log.info('Tool call arguments assembled', {
+ log.debug('Tool call arguments assembled', {

- log.info('Text content_block_start', { index: contentBlockIndex })
+ log.debug('Text content_block_start', { index: contentBlockIndex })
```

生产环境 `logLevel=info` 下不再输出这些日志。调试时设置 `logLevel=debug` 可恢复。

### 修改 B：永久禁用 cli-proxy-api（服务器运维）

```bash
systemctl stop cliproxyapi.service cliproxyapi-guard.timer cliproxyapi-guard.service
systemctl disable cliproxyapi.service cliproxyapi-guard.timer cliproxyapi-guard.service
mv /etc/systemd/system/cliproxyapi.service → .disabled
mv /etc/systemd/system/cliproxyapi-guard.timer → .disabled
mv /etc/systemd/system/cliproxyapi-guard.service → .disabled
systemctl daemon-reload
```

部署脚本 (`scripts/deploy-cloud-server.sh`) 不涉及 cli-proxy-api，无需修改。

## 涉及文件

| 文件 | 变更 |
|------|------|
| `cloud-server/src/proxy/format-converter.ts` | 4 行 — `log.info()` → `log.debug()` |
| `docs/development-status/summaries/cloud-server/src/proxy/format-converter.ts.md` | 摘要更新 — v17 版本说明 |

## 验证

- [x] `npx tsc --noEmit` — cloud-server：**零错误**
- [x] cli-proxy-api 服务确认永久禁用
- [ ] Docker 部署后观察日志量是否降为正常水平

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是
- 用户需求：
  1. 生产环境保持 logLevel=info，只把不属于 INFO 的日志降级为 debug — 确认
  2. 永久禁用 cli-proxy-api — 确认

## 下一步

- 部署到 dandwan.site 验证日志量下降
- 长期观察服务器内存使用是否稳定
- 可选：为 cloud-server 添加 Docker 日志轮转配置（`max-size`/`max-file`）作为纵深防御
