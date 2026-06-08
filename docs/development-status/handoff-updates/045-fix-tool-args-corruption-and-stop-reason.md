# 045 — 修复工具参数损坏 + stop_reason 时序 + DeepSeek Pro fallback

**日期**：2026-06-06
**类型**：Bug fix（非小修复 — 涉及核心流式转换逻辑）
**关联**：[[043-fix-streaming-tool-use-content-block-start]]（上一次修复未完全解决）

## 范围

用户在 ActiNet 云服务中使用 opencode → Anthropic API → DeepSeek 时遇到两个问题：
1. **工具无法调用**：Claude Code 反复报 `Invalid tool parameters`
2. **任务提前结束**：工具结果还没返回，对话就终止了

通过 SSH 登录 `dandwan.site` 查看 Docker 日志 + 对比 CLIProxyAPI 源码 + 多轮测试，
定位到三个独立 bug，都在 `cloud-server/src/proxy/format-converter.ts` 中。

## 根因分析（3 个 bug）

### Bug 1：`fixAndValidateArgs()` 回退 `{}` 导致工具参数损坏

DeepSeek 流式输出的 tool call arguments 片段拼接后可能形成非法 JSON。
旧代码在 6 步修复失败后回退到 `{}`，导致工具以空参数调用 → `Invalid tool parameters`。

### Bug 2：`[DONE]` 处理时 `finishReason` 使用过期值

当 tool_use `content_block_start` 在 `[DONE]` handler 中才补发时，
`finishReason` 已在之前的 chunk 中被锁定为 `end_turn`。`[DONE]` handler 直接使用
这个过期值，导致 opencode 收到 `stop_reason: end_turn` → 认为对话结束。

CLIProxyAPI 的 `convertOpenAIDoneToAnthropic()` 会调用 `effectiveOpenAIFinishReason()`
重新评估 `SawToolCall` 状态。

### Bug 3（测试中新发现）：DeepSeek V4 Pro 不发送 `id` 和 `function.name`

| 模型 | 流式模式 | `id` | `function.name` |
|------|---------|------|-----------------|
| deepseek-v4-flash (快速) | ✅ 发送 | ✅ `call_00_xxx` | ✅ `Bash` |
| deepseek-v4-pro (专家) | ❌ 缺失 | ❌ | ❌ |

Pro 模型（带 thinking）的流式 delta 只含 `function.arguments`，缺少 `id` 和 `function.name`。
导致 `emitToolUseStart` 永远不被调用，tool_use block 静默丢弃。

## 修复内容

**文件**：
- `cloud-server/src/proxy/format-converter.ts`（~80 行修改）
- `cloud-server/src/proxy/proxy-routes.ts`（~4 行修改）

### 修复 1：`fixAndValidateArgs()` 对齐 CLIProxyAPI `FixJSON` 语义

- 保留引号修复（`fixJSONQuotes`）
- 保留未闭合字符串检测/修复
- **新增**花括号平衡启发式（最常见的 DeepSeek 截断模式）
- **移除** `JSON.parse` 验证链和 `{}` 回退
- 失败时返回尽力修复的结果，仅记录 warn 日志

### 修复 2：`[DONE]` handler 重新评估 stop_reason

- 在 `closeToolCallBlocks()` 之后检查 `sawToolCall`
- 动态设置 `effectiveStopReason = sawToolCall ? 'tool_use' : finishReason`
- 对齐 CLIProxyAPI 的 `effectiveOpenAIFinishReason()` 行为

### 修复 3：工具名 fallback（DeepSeek Pro 适配）

- `createOpenaiToAnthropicStreamTransformer()` 新增 `availableToolNames` 参数
- `closeToolCallBlocks()`：当 `!block.startEmitted && !block.name` 时，使用请求中的
  第一个工具名作为 fallback，生成合成 id，发出 tool_use block
- `proxy-routes.ts` Anthropic endpoint 从请求 body 中提取工具名列表传入

## 验证

- [x] TypeScript 编译通过（`npx tsc --noEmit`）
- [x] Docker 镜像构建成功并部署到 `dandwan.site`
- [x] 专家模型流式：tool_use block 正确发出，stop_reason: tool_use
- [x] 快速模型流式：tool_use block 正确发出，stop_reason: tool_use  
- [x] 非流式：正常工作（无退化）
- [ ] 用户用 Claude Code 端到端验证（参见"已知限制"）

## 已知限制

1. **`input_json_delta` 内容质量**：DeepSeek 流式 tokenizer 会将 JSON 按字符分片，
   部分结构字符可能丢失（如 `{`、`:`、引号）。非流式模式不受影响。
   当前 `fixAndValidateArgs` 尽力修复（花括号平衡、引号闭合），但无法完全恢复。
   这与 CLIProxyAPI 的行为一致（CLIProxyAPI 也只做引号转换，不验证 JSON 合法性）。

2. **多工具场景的 fallback**：当有多个工具且上游不发送工具名时，使用第一个工具名作为
   fallback。如果实际调用了其他工具，客户端可能匹配失败。
   
3. **opencode API Key 余额**：3/4 的 key 已余额不足（401 Insufficient balance），
   建议尽快充值或清理无效 key。

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是（2026-06-06）

## 提交

- 待提交

## 下一步

1. 用户用 Claude Code 通过 ActiNet（`sk-dandwan` @ `https://47.108.210.249:2179`）端到端验证
2. 如果流式 args 质量问题影响实际使用，考虑对 Pro 模型默认禁用 thinking（`reasoning_effort: "none"`）
   或探索让 transformer 访问原始请求的工具 schema 以辅助 JSON 重建
3. 充值 opencode API key 余额
