# 042 — Anthropic API 支持完善：格式转换增强 + 协议头转发 + count_tokens

**日期**：2026-06-06

## 范围

以 CLIProxyAPI (Go, ~4000行 Anthropic 翻译代码) 作为对比基准，全面升级 cloud-server 的 Anthropic API 支持水平。涵盖 5 个 Phase：协议头转发、thinking/effort 双向映射、流式事件修复 + 内容块增强、count_tokens 端点。

## 对比分析

| 维度 | CLIProxyAPI | ActiNet (变更前) | ActiNet (变更后) |
|------|------------|-----------------|-----------------|
| thinking 配置 | 完整双向映射（budget/adaptive/effort），模型感知 | ❌ 丢弃 | ✅ 完整支持 |
| anthropic-version 头 | 透明转发 | ❌ 不转发 | ✅ 转发 |
| 缓存 token | 跟踪 cache_read + cache_creation | ❌ 不跟踪 | ✅ 跟踪 |
| Image HTTP URL | 支持 | ❌ 仅 base64 | ✅ 透传 |
| content_block_stop | 完整生命周期 | ❌ [DONE]时不发 | ✅ 修复 |
| count_tokens | — | ❌ 无端点 | ✅ 上游优先+估算回退 |
| document 块 | 支持 | ❌ | ✅ 支持 |
| redacted_thinking | 安全忽略 | ❌ 未处理 | ✅ 显式忽略 |
| top_k | 透传 | ❌ 丢弃 | ✅ 透传 |
| 错误格式 | 统一 | ❌ 混用 | ✅ Anthropic 格式 |

## 变更的代码区域

### 修改：`cloud-server/src/proxy/request-forwarder.ts`
- `forwardStreamRequest()`：转发 `anthropic-version`、`anthropic-beta`、`x-api-key` 头到上游
- `forwardNonStreamRequest()`：新增 `extraHeaders` 参数支持
- 新增 `convertOpenAIMessageContentToAnthropic()` — OpenAI 消息内容→Anthropic content-block（text/image_url/file → text/image/document）

### 修改：`cloud-server/src/proxy/format-converter.ts`（主体变更）
**thinking/effort 双向映射（~90行）：**
- 新增 `EFFORT_TO_BUDGET` 和 `BUDGET_THRESHOLDS` 映射表
- 新增 `mapBudgetToEffort()` / `mapEffortToBudget()` 转换函数
- 新增 `modelSupportsAdaptiveThinking()` — 检测模型是否支持 adaptive thinking（Claude 4.6+）
- `anthropicToOpenaiRequest()` 新增 thinking→reasoning_effort 映射
- `openaiToAnthropicRequest()` 新增 reasoning_effort→thinking+output_config 映射（模型感知：adaptive 优先，legacy 回退）

**流式修复 + 缓存 token（~20行）：**
- `createOpenaiToAnthropicStreamTransformer()` 新增 `cachedTokens` 变量和 `prompt_tokens_details.cached_tokens` 提取
- [DONE] 处理中 `message_delta` 的 usage 包含 `input_tokens` + `output_tokens` + `cache_read_input_tokens`
- 非流式 `openaiToAnthropicResponse()` 提取缓存 token 并加入 Anthropic usage

**内容块增强（~70行）：**
- `anthropicContentToOpenAI()`：HTTP URL image 支持 + document 内容块（base64→data URL）
- `anthropicToOpenaiRequest()`：thinking 内容块→reasoning_content、redacted_thinking 显式忽略、tool_result 图片内容处理
- `openaiToAnthropicRequest()`：消息内容块转换（image_url→image source，file→document）

**参数透传：**
- `top_k` 在双向请求转换中保留
- `top_p` 在 `openaiToAnthropicRequest()` 中保留

### 修改：`cloud-server/src/proxy/proxy-routes.ts`
- 新增 `POST /v1/messages/count_tokens` 端点（上游优先，10s 超时，失败回退字符估算 ~4 chars/token）
- `forwardChatCompletion()` 提取 Anthropic 协议头转发（避免重复代码）
- `/v1/messages` 非流式错误响应改为 Anthropic 格式
- `/v1/models` 错误响应按 Anthropic 格式输出（当检测到 `anthropic-version` 头时）
- Gemini 端点错误格式保持不变

## 设计决策

1. **thinking 映射模型感知**：检测模型名是否匹配 Claude 4.6+ 模式，支持 adaptive thinking 的使用 `output_config.effort`，旧模型回退 budget_tokens。不需要外部模型注册表，足够覆盖主流模型。

2. **Image HTTP URL 透传**：不下载或处理图像，仅做格式转换（Anthropic `source.url` ↔ OpenAI `image_url.url`）。上游负责实际的图像获取。

3. **count_tokens 上游优先**：尝试调用上游 `/v1/messages/count_tokens`，失败则回退到字符估算。10s 超时避免阻塞。

4. **无向后兼容**：根据用户要求，不保留旧的兼容路径，以最优架构为准。

## 不在范围

- Anthropic `computer_use`、`citations`、`prompt caching`（需要更复杂的架构支持）
- `POST /v1/messages/batches` 批量端点
- Gemini API 的相关增强（本次聚焦 Anthropic）
- 消息内容块转换仅在 request body 层面，不修改 streaming 中的单条 delta

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误

## 决策关卡

- 方案已提出：是（含 CLIProxyAPI 对比分析 + 5 Phase 详细方案）
- 用户确认已收到：是
- 用户决策：
  1. thinking 配置：按 CLIProxyAPI 做法 — 模型感知的 adaptive/legacy 映射
  2. count_tokens：上游优先，失败回退 token 估算
  3. Image HTTP URL：透传到上游，ActiNet 不处理
  4. 无向后兼容

## 已知限制

- `modelSupportsAdaptiveThinking()` 基于模型名字符串模式匹配，对于未知模型名可能误判（默认用 budget_tokens）
- count_tokens 的字符估算精度有限（~4 chars/token），对于非英文内容偏差可能较大
- 消息内容块转换覆盖了常见场景（text/image/document），但不支持 PDF 嵌入等高级格式

## 下一步

- 部署测试：用 Claude Code 连接 ActiNet 验证 thinking、工具调用、流式交互
- 回归验证 OpenAI 端点（`/v1/chat/completions`）确保消息内容块转换不影响现有功能
- 可选：添加模型注册表替代字符串匹配检测 adaptive thinking 支持
