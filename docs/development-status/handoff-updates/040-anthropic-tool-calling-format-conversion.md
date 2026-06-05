# 040 — Anthropic 格式转换：Tool Calling 支持

**日期**：2026-06-06

## 范围

为 cloud-server 的 Anthropic ↔ OpenAI 格式转换器新增完整的 Tool Calling 支持。修复前，通过 `POST /v1/messages`（Anthropic Messages API）发送的请求中，`tools` 定义被静默丢弃，导致 Claude Code 等 Anthropic 客户端无法调用工具。

## 根因

`format-converter.ts` 仅支持 `stop_reason` ↔ `finish_reason` 映射（`tool_use` ↔ `tool_calls`），但不做实际内容转换：

1. `anthropicToOpenaiRequest()` — 不转发 `tools` 定义到 OpenAI 请求体；不处理会话历史中的 `tool_use` / `tool_result` 块
2. `anthropicContentToOpenAI()` — 仅处理 `text` 和 `image` 块，忽略 `tool_use` / `tool_result`
3. `openaiToAnthropicResponse()` — 不转换 OpenAI `tool_calls` → Anthropic `tool_use` 内容块
4. `createOpenaiToAnthropicStreamTransformer()` — 不处理 `delta.tool_calls` 流式事件

## 变更的代码区域

### 修改：`cloud-server/src/proxy/format-converter.ts`（1 个文件）

**1. `anthropicToOpenaiRequest()` — 消息循环 + tools 转发**

- 消息循环重构为按角色分派：
  - **assistant 消息**：检测 `tool_use` 块 → 提取 `tool_calls` 数组（id/type/function），文本块 → `content`
  - **user 消息**：检测 `tool_result` 块 → 生成独立 `role: "tool"` 消息（`tool_call_id` + `content`）；文本块 → 普通 user 消息
- 新增 Anhropic `tools` → OpenAI `tools` 转发（`name`/`description`/`input_schema` → `type: function`/`function.name`/`function.description`/`function.parameters`）
- 新增 `tool_choice` 映射（auto/any/tool → auto/required/specific）

**2. `openaiToAnthropicResponse()` — 非流式 tool_calls 转换**

- 新增 `message.tool_calls[]` 遍历 → 每个 tool_call 转换为 Anthropic `tool_use` 内容块（`type: 'tool_use'`、`id`、`name`、`input`）
- 参数 JSON 解析带 fallback（解析失败时 `input: {}`）

**3. `createOpenaiToAnthropicStreamTransformer()` — 流式 tool_calls 转换**

- 新增 `toolCallBlocks` Map 追踪按 OpenAI index 的活跃 tool call 状态机
- 新增 `closeActiveBlock()` / `closeToolCallBlocks()` 辅助函数管理内容块生命周期
- 流式 tool_calls delta 处理：
  - 新 tool call（index 未见过）→ 关闭当前 text/thinking 块 → 发送 `content_block_start`（type: `tool_use`）
  - 后续参数增量 → 发送 `content_block_delta`（type: `input_json_delta`，`partial_json`）
  - 处理 name/id 延迟到达的情况
- `[DONE]` 时关闭所有活跃 tool call 块
- text/thinking 块开始前关闭活跃 tool call 块，避免块交错

## 设计决策

1. **消息处理按角色分派**：assistant 的 `tool_use` 块和 user 的 `tool_result` 块在 `anthropicToOpenaiRequest` 的主循环中处理，而非修改 `anthropicContentToOpenAI` 的返回类型——避免大面积改动
2. **流式状态机**：使用 `Map<number, block>` 按 OpenAI tool call index 追踪状态，处理增量式 delta 到达
3. **content_block_start 包含完整 tool_use 信息**：id + name + input:{}；参数通过 input_json_delta 增量流式传输
4. **JSON 解析容错**：非流式中 JSON.parse 失败时回退 `input: {}`，不中断响应
5. **向后兼容**：所有新增逻辑在字段不存在时走原有路径；纯文本对话不受影响

## 不在范围

- Anthropic `computer_use` 内容块类型
- Anthropic `citations` / `thinking` 扩展签名字段
- 并行 tool_use（多 tool 并发调用）的高级处理
- tool_result 中的图片/多模态内容

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- Docker 重新构建并部署到 `dandwan.site`
- curl 测试（`POST /v1/messages`）：
  - 纯文本请求 → 200，正常返回 text + thinking ✓
  - 带 `tools` 定义的非流式请求 → `tool_use` 块 + `stop_reason: "tool_use"` ✓
  - 带 `tools` 定义的流式请求 → `content_block_start` (tool_use) → `input_json_delta` 流式参数 → `content_block_stop` → `stop_reason: "tool_use"` ✓

## 决策关卡

- 方案已提出：是（含 4 个转换点的详细方案）
- 用户确认已收到：是

## 已知限制

- 并发多 tool_use blocks 在流式中的 content_block_index 处理偏简单（当前按线性递增，多 tool 并发可能需要更复杂的索引映射）
- tool_result 内容中的图片等非文本 content block 会被忽略
- 未处理 Anthropic `tool_use` 的 `cache_control` 等高级特性

## 下一步

- 用户用 Claude Code 连接 `sk-dandwan` 实测多轮工具调用交互
- 观察生产日志中 tool calling 的实际表现
- 可选：支持 `tool_result` 中的图片/多模态内容
- 可选：支持并行 tool_use 的高级流式状态管理
