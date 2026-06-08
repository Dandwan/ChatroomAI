# 043 — 修复 OpenAI→Anthropic 流式 tool_use 转换的 content_block_start 时序问题

**日期**: 2026-06-06  
**类型**: Bug fix  
**关联 commit**: (pending)

## 问题描述

用户在云服务中通过 Anthropic Messages API 端点使用 DeepSeek 模型时，Claude Code 反复报 `Invalid tool parameters`，tool calling 无法正常工作。同时服务端日志出现 DeepSeek 报错 `Invalid assistant message: content or tool_calls must be set`。

## 根因分析

对比 CLIProxyAPI（https://github.com/router-for-me/CLIProxyAPI，已验证在同一场景下正常工作）的 `openai_claude_response.go` 实现，发现 `createOpenaiToAnthropicStreamTransformer` 存在三个关键差异：

### 1. content_block_start 过早发送（主要 bug）

**Cloud Server（旧）**: 第一个 `tool_calls` delta chunk 到达时立即发出 `content_block_start`，此时 `id` 或 `name` 可能为空字符串。违反 Anthropic 协议 — `content_block_start` for `tool_use` 必须包含有效的 `id` 和 `name`，且发出后无法修改。

**CLIProxyAPI**: 延迟到 `accumulator.Name != ""` AND `accumulator.ID != ""` 都满足后才调用 `emitToolUseStart()`，在每个 chunk 上重新检查条件。

### 2. 增量 partial_json vs 完整 JSON

**Cloud Server（旧）**: 每收到一个 arguments chunk 就作为增量 `partial_json` 发送。如果上游（如 DeepSeek）产生的增量 JSON 片段不完整或有误，客户端拼装后会得到无效 JSON。

**CLIProxyAPI**: 流式过程中只累积 arguments，在 `content_block_stop` 前一次性发送完整拼装 JSON（经 `FixJSON` 修复）。

### 3. Tool ID 格式清洗

**Cloud Server（旧）**: 直接透传 OpenAI 格式的 tool call ID（如 `call_xxx`）。

**CLIProxyAPI**: 经 `SanitizeClaudeToolID()` 清洗确保符合 Anthropic 的 `^[a-zA-Z0-9_-]+$` 正则。

### 4. anthropicToOpenaiRequest 消息转换

当 Anthropic assistant 消息只包含 `thinking` 块（无 text、无 tool_use）时，旧代码生成 `{content: null, reasoning_content: "..."}` — DeepSeek 不接受只有 `reasoning_content` 而 `content` 和 `tool_calls` 都为空的 assistant 消息。

## 修复内容

**文件**: `cloud-server/src/proxy/format-converter.ts`（~130 行新增/修改）

### createOpenaiToAnthropicStreamTransformer

- **延迟 `content_block_start`**: 新增 `startEmitted` 标志，只有当 `block.id` 和 `block.name` 都非空时才调用 `emitToolUseStart()`
- **完整 `input_json_delta`**: 流式过程中只累积 `block.args`，在 `closeToolCallBlocks` 时发送一次性完整 JSON（经 `fixJSON` 修复）
- **`sawToolCall` 标志**: 替代原始 upstream `tool_calls` 存在性检测，防止 `stop_reason=tool_use` 但实际没有 tool block 被发出的情况
- **Tool ID 清洗**: 新增 `sanitizeToolId()` 函数，过滤非 `[a-zA-Z0-9_-]` 字符，空 ID 生成 fallback
- **JSON 修复**: 新增 `fixJSON()` 函数，处理单引号字符串等常见上游 JSON 格式问题
- **唯一 block index**: 新增 `toolContentBlockIndex()` 函数（参考 CLIProxyAPI 的 `ToolCallBlockIndexes` map），确保多个 tool block 各获得唯一 index
- **确定性排序**: `closeToolCallBlocks` 按 OpenAI tool index 排序输出

### anthropicToOpenaiRequest

- Assistant 消息处理：当没有 text 也没有 tool_use 时，`content` 设为空字符串 `''` 而非 `null`，避免 DeepSeek 报 `Invalid assistant message`

## 关键代码变更位置

- `cloud-server/src/proxy/format-converter.ts`
  - `createOpenaiToAnthropicStreamTransformer()`: L859-1024（函数内部状态、helper、transform 逻辑重写）
  - `anthropicToOpenaiRequest()`: L486-497（content 赋值逻辑）

## 验证方式

- [x] TypeScript 编译通过（`tsc --noEmit`）
- [x] Docker 镜像构建成功并部署到服务器
- [ ] 用户用 Claude Code + `sk-dandwan` 测试 tool calling 是否正常
