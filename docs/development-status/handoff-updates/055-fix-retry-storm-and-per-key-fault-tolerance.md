# 055 — 修复 "响应一次后全部 503" 恶性循环 + 实现 per-key 容错

**日期**：2026-06-07
**类型**：Bug fix + Feature（非小修复 — 涉及 5 个文件，含 per-key 容错新功能）

## 问题描述

用户反馈：API 连接 ActiNet 云服务后，响应一次就全部返回 503，需要多次重试后才恢复。SSH 排查日志发现三个独立根因形成恶性循环。

## 根因分析（3 个独立问题）

### 根因 1：`key_fault_tolerance` 三层缺失

1. **DB 值覆盖默认值**：`upstreams.key_fault_tolerance = 0`，`proxy-routes.ts` 使用 `??` 运算符，`0` 不是 null/undefined 导致不回落到全局默认 `5`
2. **`UpstreamApiKey` 不支持容错**：类型定义、DB 仓库完全不读/写 `fault_tolerance` 列（列已存在但未使用）
3. **无 key 级容错**：无法针对特定 key 设置不同的容错次数

### 根因 2：错误分类器收到的 statusCode 永远是 502

`request-forwarder.ts` 正确地将上游状态码嵌入错误消息（如 `上游流式请求失败 (400): ...`），但 `proxy-routes.ts` catch 块将 `result.statusCode` 硬编码为 502。`shouldMarkUnhealthy()` 看到 502（5xx）直接标记 unhealthy，400 客户端错误本应豁免但无法识别。

### 根因 3：`reasoning_effort: 'none'` 仍在被发送

`format-converter.ts` 的 `anthropicToOpenaiRequest()` 有独立于 `thinking.ts` 的重复 thinking 逻辑，当 `level === 'none'` 时直接赋值 `openaiBody.reasoning_effort = 'none'`。`thinking.ts` 的修复（`delete body.reasoning_effort`）未同步到此重复代码。

## 修复内容

### 修改 A：实现 per-key 三级容错解析链（`types.ts` + `upstream-repo.ts` + `proxy-routes.ts` + `admin-routes.ts`）

- **`types.ts`**：`UpstreamApiKey` 新增 `fault_tolerance: number | null`
- **`upstream-repo.ts`**：`keyFromRow` 读取 `fault_tolerance`；`createKey` 写入 `fault_tolerance` 列；`updateKey` 支持更新 `fault_tolerance`
- **`proxy-routes.ts`**：新增 `resolveFaultTolerance(keyFt, upstreamFt, globalFt)` — key → upstream → global 三级解析，`-1`/null/undefined 回落下一级，`>= 0` 为显式值
- **`admin-routes.ts`**：POST upstreams 和 POST keys 端点接受 per-key `fault_tolerance` 参数

### 修改 B：修复错误分类器 statusCode（`proxy-routes.ts`）

catch 块从错误消息中正则提取上游真实状态码：`/上游.*请求失败 \((\d+)\)/`，回落 502

### 修改 C：修复 `reasoning_effort: 'none'`（`format-converter.ts`）

`anthropicToOpenaiRequest()` 中移除 `openaiBody.reasoning_effort = 'none'` 赋值，改为注释说明省略该字段

### 修改 D：DB 数据迁移

将现有 `upstreams.key_fault_tolerance = 0` 和 `upstream_api_keys.fault_tolerance = 0` 更新为 `-1`（使用默认值标记）

## 涉及文件

| 文件 | 变更 |
|------|------|
| `cloud-server/src/types.ts` | +1 字段 — `UpstreamApiKey.fault_tolerance` |
| `cloud-server/src/db/repositories/upstream-repo.ts` | ~10 行 — 读写 `fault_tolerance` 列 |
| `cloud-server/src/proxy/proxy-routes.ts` | ~25 行 — `resolveFaultTolerance()` + statusCode 提取 |
| `cloud-server/src/proxy/format-converter.ts` | ~5 行 — 删除 `reasoning_effort = 'none'` |
| `cloud-server/src/admin/admin-routes.ts` | ~5 行 — 接受 per-key `fault_tolerance` |

## 验证

- [x] `npx tsc --noEmit` — 零 TypeScript 错误
- [x] Docker 构建 + 部署到 dandwan.site
- [x] DB 迁移：14 个 key + 1 个 upstream 的 `fault_tolerance` 从 `0` 更新为 `-1`
- [x] 容器启动无错误
- [x] 部署代码验证：`resolveFaultTolerance`、`statusMatch`、format-converter 注释均已到位

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是
- 用户需求修正：
  1. 每个 key 都要支持单独设置容错 — 已实现
  2. 默认值使用 `-1` 标记 — 已实现（三级解析链中 `>= 0` 为显式值）
  3. 修复后使用一键部署脚本 — 已执行

## 下一步

- 用户可观察生产日志确认 `tolerance` 字段不再为 0，`reasoning_effort` 错误不再出现
- Admin UI 可后续添加 per-key fault_tolerance 输入控件（后端已支持参数）
- 可选：清理孤儿 key（7 个附加到已删除 upstream 的 key，各含 5000+ error 健康检查记录）
