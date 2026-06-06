# `cloud-server/src/proxy/format-converter.ts`

## 功能
OpenAI ↔ Anthropic API 格式转换模块。提供请求体转换（双向）、非流式响应转换（双向）和 SSE 流式事件转换（双向）。**v8: 新增反向转换器 `anthropicToOpenaiRequest()`、`openaiToAnthropicResponse()`、`createOpenaiToAnthropicStreamTransformer()`，支持原生 Anthropic Messages API 端点。** OpenAI→Anthropic 响应转换支持推理模型的 `reasoning_content` → `thinking` block 映射（非流式+流式）。**v9: `anthropicToOpenaiRequest()` 新增 tools 定义转发和 tool_use/tool_result 会话历史转换；`openaiToAnthropicResponse()` 新增 tool_calls → tool_use 块转换；`createOpenaiToAnthropicStreamTransformer()` 新增流式 tool_calls → tool_use SSE 事件转换。** **v10: 新增 thinking/effort 双向映射（OpenAI `reasoning_effort` ↔ Anthropic `thinking` + `output_config.effort`，模型感知）；Image HTTP URL 透传；document 内容块支持；tool_result 图片内容处理；缓存 token 统计（`cache_read_input_tokens`）；`content_block_stop` 事件时序修复；`redacted_thinking` 安全忽略；`top_k`/`top_p` 参数透传。** **v11: thinking 逻辑抽取至 `thinking.ts` — 移除内联常量/函数（EFFORT_TO_BUDGET、BUDGET_THRESHOLDS、mapBudgetToEffort、mapEffortToBudget、modelSupportsAdaptiveThinking），改为委托调用。`openaiToAnthropicRequest` 和 `anthropicToOpenaiRequest` 中的 thinking 逻辑现在分别委托给 `applyAnthropicThinking()` 和 `extractAnthropicThinking()`。** **v12: 修复 tool call streaming 三个 bug — (1) `fixAndValidateArgs()` 不再回退 `{}`，改为尽力修复后直接返回（对齐 CLIProxyAPI FixJSON）；(2) `[DONE]` handler 重新评估 `sawToolCall` 以确定正确的 `stop_reason`；(3) `createOpenaiToAnthropicStreamTransformer()` 新增 `availableToolNames` 参数，`closeToolCallBlocks()` 中当上游（DeepSeek V4 Pro）不发送 `id`/`name` 时使用请求工具名作为 fallback。** **v13: 对齐 CPA 翻译行为 — `anthropicToOpenaiRequest()` 的 system 处理显式剥离所有 `cache_control`，仅在多轮对话时对 block[1,2] 重新添加（跳过 bill header block[0]）；assistant 无文本也无 tool_use 时 content 改为 `null`（匹配 CPA）。** **v14: TransformStream 行缓冲 — `createOpenaiToAnthropicStreamTransformer()` 和 `createAnthropicStreamTransformer()` 新增 `lineBuffer`，拼接跨 `transform()` 调用的不完整 SSE 行后再 `split('\n')`。防止 TCP 分片导致 SSE JSON 行被截断而静默丢弃。`flush()` 丢弃残留不完整行。`createOpenaiToAnthropicStreamTransformer()` 新增 `enqueue()` 辅助函数追踪输出字节，`flush()` 输出 `inputBytes`/`outputBytes`/`calls`/`bufferRemaining` 诊断日志。** **v15（053）: 全链路对齐 CPA 源码 — (1) `max_tokens` 仅当请求中存在时设置（移除 4096 默认值）；(2) `temperature`/`top_p` 改为互斥（`else if`）；(3) `openaiToAnthropicResponse()` 的 `stopReasonMap` 新增 `function_call: 'tool_use'`（Legacy OpenAI 兼容）。详见 handoff-updates/053-cpa-actinet-full-alignment.md。** **v16: Anthropic→OpenAI thinking 对齐 thinking.ts — `anthropicToOpenaiRequest()` 内联的 `reasoning_effort = 'none'` 赋值改为仅注释说明省略该字段，对齐 `thinking.ts applyOpenAIThinking()` 的行为（DeepSeek 等上游不接受 `'none'` 为有效值）。**

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`
- `cloud-server/src/proxy/thinking.ts` — `mapBudgetToEffort`, `mapEffortToBudget`, `applyAnthropicThinking`, `extractAnthropicThinking`

### 提供
- `openaiToAnthropicRequest()` — 将 OpenAI 格式的请求体转换为 Anthropic Messages API 格式（含 thinking/effort 映射 + 消息内容块转换）
- `anthropicToOpenaiResponse()` — 将 Anthropic 非流式响应转换为 OpenAI chat completion 格式（含缓存 token）
- `createAnthropicStreamTransformer()` — 创建 TransformStream，将 Anthropic SSE 流转换为 OpenAI SSE 流
- `anthropicToOpenaiRequest()` — **v8** 反向：Anthropic Messages API 请求 → OpenAI chat completions 格式（含 thinking→reasoning_effort 映射 + thinking→reasoning_content + redacted_thinking 防护 + tool_result 图片处理）
- `openaiToAnthropicResponse()` — **v8** 反向：OpenAI chat completion 响应 → Anthropic Messages API 格式（含缓存 token 转发）
- `createOpenaiToAnthropicStreamTransformer()` — **v8** 反向：OpenAI SSE 流 → Anthropic SSE 流（含 content_block_stop 修复 + 缓存 token 跟踪）
- `convertOpenAIMessageContentToAnthropic()` — **v10** OpenAI 消息内容 → Anthropic content-block 格式（text/image_url/file → text/image/document）
- `anthropicContentToOpenAI()` — Anthropic content-block → OpenAI 格式（含 HTTP URL image + document 支持）

### 被依赖
- `proxy-routes.ts`
- `responses-api.ts`

### 被依赖
- `cloud-server/src/proxy/proxy-routes.ts` — 根据上游/客户端 API 类型调用格式转换

## 关键词
### 函数
- `openaiToAnthropicRequest`
- `anthropicToOpenaiResponse`
- `createAnthropicStreamTransformer`
- `anthropicToOpenaiRequest`
- `openaiToAnthropicResponse`
- `createOpenaiToAnthropicStreamTransformer`
- `convertOpenAIMessageContentToAnthropic`
- `anthropicContentToOpenAI`
- `mapBudgetToEffort`
- `mapEffortToBudget`
- `modelSupportsAdaptiveThinking`
- `createOpenAIChunk`
