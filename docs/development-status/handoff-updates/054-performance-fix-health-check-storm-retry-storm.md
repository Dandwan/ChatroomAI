# 054 — 修复 ActiNet 管理后台性能问题（健康检查风暴 + 重试风暴）

**日期**：2026-06-07
**类型**：Bug fix（非小修复 — 涉及 6 个文件，含架构级加固）

## 问题描述

部署在 `dandwan.site` 的 ActiNet 管理后台响应缓慢，API 延迟高。通过 SSH 排查发现 CPU 长期占用 31%，容器输出每秒 70+ 行健康检查日志。

## 根因分析（5 个独立问题）

### 根因 1：健康检查即时检测无限循环（CPU 风暴主因）

**位置**：`health-checker.ts:86-93` — `checkKeyById()`

```
checkKeyById() → 检测失败 → markUnhealthy(keyId)
  → scheduleImmediateCheck(keyId)   // setTimeout(0)
    → checkKeyById() 再次被调用
      → 又失败 → markUnhealthy() 再次触发
        → ... 无限循环
```

`scheduleImmediateCheck` 的 debounce（`pendingChecks` Set）在 `setTimeout(0)` 回调开头就被清除，而 `checkKeyById` 是异步的（~100ms 网络超时）。等它执行完再调用 `markUnhealthy` 时，debounce 早已失效。

**proxy-diff upstream（7 个 unreachable key）× 每秒 10 次 = 每秒 70 次 fetch() + 70 条 WARN 日志**

### 根因 2：用户请求无限重试风暴

一个 `deepseek-v4-flash` 请求带 `reasoning_effort: "none"` 参数，被 DeepSeek 拒绝（`unknown variant 'none'`）。由于：
- `fault_tolerance=0`：每次失败立即标记 key 不健康
- 健康检查在几秒后恢复 key 为健康状态
- 重试循环重新拾取 → 再次失败 → 再次标记 → 无限循环
- **日志记录 116+ 次尝试，22 轮**

### 根因 3：`reasoning_effort: 'none'` 格式 Bug

**位置**：`thinking.ts:290-292` — `applyOpenAIThinking()`

```typescript
body.reasoning_effort = 'none'
```

DeepSeek V4 不接受 `'none'` 为有效值（仅接受 high/low/medium/max/xhigh）。应删除该字段（默认即无思考）。

### 根因 4：Fault Tolerance 默认值为 0

单个失败立即标记 key 不健康，与健康检查恢复形成乒乓效应。

### 根因 5：DB 偶发损坏

`database disk image is malformed` 错误在特定 JOIN 查询时出现。通过干净重启（sql.js 内存 DB 正常落盘）修复。

## 修复内容

### 修改 A：修复健康检查无限循环（`health-checker.ts` ~5 行）

- `checkKeyById()` 检测失败时不再调用 `markUnhealthy()`（key 已在不健康集合中，无需重复标记）
- 移除 `markUnhealthy` 导入
- 更新误导注释

### 修改 B：即时检测冷却时间（`model-strategy.ts` 1 行）

- `scheduleImmediateCheck()` 的 `setTimeout` 从 `0` 改为 `30_000`（30 秒冷却），纵深防御

### 修改 C：新建错误分类器（`error-classifier.ts` 新建 ~80 行）

- `shouldMarkUnhealthy()` 函数 — 仅以下错误标记 key 不健康：

| 分类 | 触发条件 | 标记 |
|------|---------|:--:|
| 网络不可达 | fetch failed / ENOTFOUND / ECONNREFUSED / ETIMEDOUT 等 | ✅ |
| 上游服务端错误 | HTTP 5xx | ✅ |
| 认证/计费/Key 无效 | HTTP 401/402/403（含余额不足） | ✅ |
| 速率限制 | HTTP 429 | ✅ |
| 客户端请求错误 | HTTP 400/404/405/422（参数校验失败等） | ❌ |

### 修改 D：重试断路器（`proxy-routes.ts` ~45 行）

- `MAX_TOTAL_ATTEMPTS = 30` — 总尝试次数上限
- `MAX_CONSECUTIVE_4XX = 3` — 连续 4xx 提前终止（请求本身有问题）
- `consecutive4xx` 计数器 — 仅计算非认证类 4xx
- `markUnhealthy` 前调用 `shouldMarkUnhealthy()` 分类判断

### 修改 E：修复 `reasoning_effort: 'none'`（`thinking.ts` 1 行）

- `applyOpenAIThinking()` 中 `reasoning_effort = 'none'` → `delete body.reasoning_effort`

### 修改 F：Fault Tolerance 默认值（`config.ts` 1 行）

- `defaultFaultTolerance` 默认值 0 → 5

### 修改 G：修复数据库

- 通过干净部署（正常停止 → sql.js 落盘 → 重启）修复偶发 DB 损坏
- 部署前导出完整 DB JSON 备份作为安全保障

## 涉及文件

| 文件 | 变更 |
|------|------|
| `cloud-server/src/upstream/health-checker.ts` | ~5 行 — 删除 `markUnhealthy` 调用 + 移除导入 |
| `cloud-server/src/proxy/model-strategy.ts` | ~1 行 — `setTimeout(0)` → `30_000` |
| `cloud-server/src/proxy/error-classifier.ts` | **新建** ~80 行 — 错误分类器 |
| `cloud-server/src/proxy/proxy-routes.ts` | ~45 行 — 断路器 + 错误分类器接入 |
| `cloud-server/src/proxy/thinking.ts` | ~1 行 — `reasoning_effort = 'none'` → `delete` |
| `cloud-server/src/config.ts` | ~1 行 — `defaultFaultTolerance` 0 → 5 |

## 验证

### 编译
- `npx tsc --noEmit` — cloud-server：**零错误**

### 部署后效果
| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| CPU | 31% | **0.05%** |
| 内存 | 185MB | **128MB** |
| 日志量 | 70 行/秒 | 0（空闲时） |
| Admin Login | — | 130ms |
| Admin Dashboard | — | 8ms |
| API /v1/models | — | 5ms |

### DB 完整性
- `PRAGMA integrity_check` → `ok`
- 所有 9 个表数据完整（users, upstreams, api_keys, usage_logs 等）

## 决策关卡

- 方案已提出：是（两轮修订，含用户反馈）
- 用户确认已收到：是
- 需求修订：
  1. 速率限制（429）也标记为不健康 — 确认
  2. 认证/账单错误统一处理 — 确认
  3. DB 修复包含在本次 — 确认
  4. `reasoning_effort: 'none'` 无需验证 CPA — 确认
  5. proxy-diff 上游用户手动处理 — 确认
  6. 当前 Fault Tolerance 值用户手动设置 — 确认

## 已知限制

1. proxy-diff upstream（`http://127.0.0.1:9001`，7 个 unreachable key）仍启用 — 用户表示手动处理
2. 错误分类为启发式匹配（`errorMessage.includes()`），极端情况可能误判
3. `MAX_TOTAL_ATTEMPTS=30` / `MAX_CONSECUTIVE_4XX=3` 为经验值，可能需要根据实际使用调整

## 下一步

- 用户手动禁用/删除 proxy-diff upstream
- 用户手动设置 OpenCode upstream 的 `key_fault_tolerance` 为合理值
- 可选：将错误分类器的文本匹配升级为正则/结构化匹配
- 可选：将断路器上限暴露为 Admin UI 可配置项
