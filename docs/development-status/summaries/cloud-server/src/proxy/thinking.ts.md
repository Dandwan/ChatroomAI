# thinking.ts

## 功能
统一的 Thinking 配置子系统，处理 OpenAI/Anthropic/Gemini 三个 provider 的 thinking 配置。从 `format-converter.ts` 提取的内联逻辑，新增：

1. 模型名后缀解析：`claude-sonnet-4-5(high)` → level=high, `model-name(16384)` → budgetTokens=16384
2. Level ↔ Budget 双向映射（6 个标准级别：none/minimal/low/medium/high/xhigh/max 对应具体 token 预算）
3. Per-provider 配置提取：从 request body 中解析 reasoning_effort (OpenAI)、thinking.type+budget_tokens (Anthropic)、thinkingConfig.thinkingLevel/thinkingBudget (Gemini)
4. Per-provider 配置应用：将 NormalizedThinkingConfig 写回 request body。**v1: `applyOpenAIThinking()` 当 level 为 'none' 时删除 `reasoning_effort` 字段而非赋值为 `'none'` — 部分上游（如 DeepSeek）不接受 `'none'` 为有效值。**
5. 统一的 `processThinking()` 管道

## 关系
### 调用 / 引用
- `./model-registry.js` — `lookupModelInfo` 获取模型能力
- `../types.js` — `ThinkingLevel`, `ThinkingSuffix`, `NormalizedThinkingConfig`, `ApiType`

### 提供
- `LEVEL_TO_BUDGET`, `BUDGET_THRESHOLDS` — 导出的常量映射
- `parseThinkingSuffix(modelName)` — 解析模型名后缀
- `mapBudgetToLevel(budget)`, `mapLevelToBudget(level)` — 双向映射
- `mapLevelToClaudeEffort(level, supportsMax)` — Level → Claude adaptive effort
- `mapClaudeEffortToLevel(effort)` — Claude effort → Level
- `extractOpenAIThinking(body)`, `extractAnthropicThinking(body)`, `extractGeminiThinking(body)` — per-provider 配置提取
- `applyOpenAIThinking(body, config)`, `applyAnthropicThinking(body, config, modelName?)`, `applyGeminiThinking(body, config)` — per-provider 配置应用
- `processThinking(body, provider, modelName)` — 完整管道（suffix 解析 + 提取 + 应用）
- `resolveModelThinking(modelName)` — 解析 base model + suffix
- `mapEffortToBudget(effort)`, `mapBudgetToEffort(budget)` — 已弃用的兼容函数

### 被依赖
- `format-converter.ts`
- `format-gemini.ts`

## 关键词
### 函数
- `parseThinkingSuffix`
- `mapBudgetToLevel`
- `mapLevelToBudget`
- `mapLevelToClaudeEffort`
- `extractOpenAIThinking`
- `extractAnthropicThinking`
- `extractGeminiThinking`
- `applyOpenAIThinking`
- `applyAnthropicThinking`
- `applyGeminiThinking`
- `processThinking`
- `resolveModelThinking`
