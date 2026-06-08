# 053 — CPA vs ActiNet 全链路行为对齐完成

**日期**：2026-06-07
**状态**：已部署、已测试

## 范围

基于 CPA 源码（`github.com/router-for-me/CLIProxyAPI`）的 `ConvertClaudeRequestToOpenAI()` 和 `ConvertOpenAIResponseToClaude()` 全链路对比分析，将 ActiNet 的 Anthropic ↔ OpenAI 翻译行为与 CPA 完全对齐。

共修改 2 个文件、6 处代码。

## 变更

### 文件 1: `cloud-server/src/proxy/format-converter.ts`（3 处）

#### 1. `max_tokens` 仅当请求中存在时设置（line 575-579）

**Before**: `max_tokens: body.max_tokens ?? 4096`（始终有默认值）
**After**: 仅当 `body.max_tokens !== undefined` 时才设置
**CPA 源码**: `openai_claude_request.go:32-33` — `if maxTokens := root.Get("max_tokens"); maxTokens.Exists() { ... }`
**验证**: 单元测试通过 — 无 max_tokens 的请求不再输出 4096 默认值

#### 2. `temperature`/`top_p` 互斥（line 582-586）

**Before**: 两者独立设置
**After**: `if (body.temperature) { ... } else if (body.top_p) { ... }`
**CPA 源码**: `openai_claude_request.go:37-40` — 使用 `else if` 语义
**验证**: 单元测试通过 — 两者同时存在时仅输出 temperature

#### 3. `function_call` finish_reason 映射（line 744）

**Before**: 映射表缺少 `function_call`
**After**: 新增 `function_call: 'tool_use'`（Legacy OpenAI 兼容）
**CPA 源码**: `openai_claude_response.go:501-502`

### 文件 2: `cloud-server/src/proxy/request-forwarder.ts`（3 处）

#### 4. 流式请求头：`Accept`/`Cache-Control`/`User-Agent`（line 86-92）

**Before**: 仅设置 `Content-Type` 和 `Authorization`，undici 自动注入 `sec-fetch-mode: cors`、`accept-language: *` 等浏览器式头
**After**: 显式设置 `Accept: text/event-stream`、`Cache-Control: no-cache`、`User-Agent: cli-proxy-openai-compat`
**CPA 源码**: `openai_compat_executor.go:141,345-346,487-488`

#### 5. 非流式请求头：`Accept`/`User-Agent`（line 350-351）

**Before**: 仅设置 `Content-Type` 和 `Authorization`
**After**: 新增 `Accept: application/json`、`User-Agent: cli-proxy-openai-compat`

#### 6. 移除注释中已过时的说明

删除关于 "Forwarding client headers is unsafe" 的旧注释，替换为 CPA 对齐说明。

## 全链路对齐状态

### 请求方向（Anthropic → OpenAI）— 全部 ✅

| # | 项目 | 状态 |
|---|------|------|
| 1 | System billing header 过滤 | ✅ |
| 2 | System 无 cache_control | ✅ |
| 3 | Assistant content 数组格式 | ✅ |
| 4 | Assistant 无文本时 `content: ""` | ✅ |
| 5 | User content 数组格式 | ✅ |
| 6 | 空 tools 省略 | ✅ |
| 7 | `max_tokens` 无默认值 | ✅（本次修复） |
| 8 | `temperature`/`top_p` 互斥 | ✅（本次修复） |
| 9 | 上游 `Accept` 头显式设置 | ✅（本次修复） |
| 10 | 上游 `Cache-Control: no-cache` | ✅（本次修复） |
| 11 | 上游 `User-Agent` | ✅（本次修复） |
| 12 | Anthropic 头不转发 | ✅ |
| 13 | `stream_options.include_usage` | ✅ |
| 14 | `reasoning_effort` 映射 | ✅ |
| 15 | `tool_choice` 映射 | ✅ |

### 响应方向（OpenAI → Anthropic）— 全部 ✅

| # | 项目 | 状态 |
|---|------|------|
| 16 | finish_reason 完整映射（含 `function_call`） | ✅（本次修复） |
| 17 | SSE 流式转换（thinking/text/tool_use） | ✅ |
| 18 | SawToolCall 机制 | ✅ |
| 19 | 非流式响应转换 | ✅ |
| 20 | usage 处理（含 cached_tokens） | ✅ |

## 验证

- `npx tsc --noEmit` — **零错误**
- 部署容器内 12 项单元测试 — **全部通过**（含 max_tokens 默认值、temperature/top_p 互斥）
- 上游请求头源码检查 — **通过**（无 browser-like 头注入）

### 待端到端验证

- proxy-diff 测试套件（需恢复上游配置后运行 36 个会话对比）
- 流式 SSE chunk-by-chunk 对比

## 涉及文件

| 文件 | 变更行数 | 变更内容 |
|------|---------|---------|
| `cloud-server/src/proxy/format-converter.ts` | +11 / -5 | max_tokens 默认值 + temp/top_p 互斥 + function_call 映射 |
| `cloud-server/src/proxy/request-forwarder.ts` | +10 / -6 | 上游请求头显式设置 |

## 决策关卡

- 方案已提出：是（含 CPA 源码逐行对比 + 部署代码运行时验证）
- 用户确认已收到：是
