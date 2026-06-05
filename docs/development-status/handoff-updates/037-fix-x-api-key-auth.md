# 037 — 修复 x-api-key 认证 + rate-limiter 管理 Key 兼容 + reasoning_content 格式转换

**日期**：2026-06-06

## 范围

修复三个关联的 401 / 空响应问题：
1. `x-api-key` 请求头不被识别（Anthropic 兼容客户端）
2. 管理员创建的独立 API Key 被 rate-limiter 误拦
3. DeepSeek 推理模型的 `reasoning_content` 在 Anthropic 格式转换中被丢弃

## 变更的代码区域

### 修改（3 个）
- `cloud-server/src/auth/middleware.ts` — `extractToken()` 新增 `x-api-key` 头读取
- `cloud-server/src/proxy/rate-limiter.ts` — 非用户 Key 跳过限流而非 401
- `cloud-server/src/proxy/format-converter.ts` — `openaiToAnthropicResponse` + `createOpenaiToAnthropicStreamTransformer` 支持 `reasoning_content` → `thinking` block 映射

## 根因

### 问题 1：x-api-key 不被识别
Anthropic 兼容客户端通过 `x-api-key` 头发送 API Key。`extractToken` 只读取 `Authorization` 头。

### 问题 2：rate-limiter 拦管理 Key
`sk-dandwan` 是管理员创建的独立 Key（`api_keys` 表）。auth 中间件将其 `id` 设为 `req.userId`，但 rate-limiter 用 `users.findById()` 查用户表 → 返回 401。

### 问题 3：reasoning_content 被丢弃
DeepSeek 推理模型返回 `reasoning_content`（思考过程）+ `content`（最终回复）。`openaiToAnthropicResponse` 只取 `content`，丢弃思考过程。当 `max_tokens` 太小时，所有 token 用于推理，`content` 为空 → Anthropic 客户端收到 `content: []`。

## 修复

### middleware.ts
`extractToken` 按顺序：`Authorization: Bearer` → `Authorization` 原始值 → `x-api-key`

### rate-limiter.ts
`users.findById` 返回 null → 跳过限流而非 401

### format-converter.ts
- **非流式**：`reasoning_content` → `{ type: 'thinking', thinking: ... }` block，在 text block 之前
- **流式**：新增 `thinkingBlockStarted` 状态，处理 `delta.reasoning_content` → `thinking_delta` SSE 事件；切换到 `delta.content` 时递增 `contentBlockIndex`

## 决策关卡

- 前两个问题：小修复豁免
- 第三个问题：完整方案关卡（方案对用户确认）

## 验证

- `npx tsc --noEmit` — 零错误
- 远端测试：
  - `x-api-key: sk-dandwan` → `/v1/models` 200 ✅
  - `Authorization: Bearer sk-dandwan` → `/v1/models` 200 ✅
  - `/v1/chat/completions` (deepseek-v4-flash, max_tokens=256) → 正常返回 ✅
  - `/v1/messages` (deepseek-v4-flash, max_tokens=2048) → content 包含 text ✅
  - `/v1/messages` (deepseek-v4-flash, max_tokens=256) → 远端未部署新代码，content: []

## 已知限制

- 管理员创建的独立 API Key 无频率限制
- `reasoning_content` 映射为纯文本 `thinking` block，不做 Anthropic 扩展思考的签名验证
- 远端服务器尚未部署最新代码（format-converter 修复），需部署后重新验证

## 下一步

- 部署更新后的代码到远端服务器
- 用小 `max_tokens` 测试 `/v1/messages`，确认 thinking block 正常出现
