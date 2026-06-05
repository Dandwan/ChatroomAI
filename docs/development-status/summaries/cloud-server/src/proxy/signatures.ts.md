# signatures.ts

## 功能
跨 provider 签名清洗模块。当用户跨 Claude/GPT/Gemini 切换模型时，消息历史中的 thinking 签名和 provider 特定元数据可能不兼容上游 API。此模块清理消息数组以避免上游拒绝。

清洗规则：
- Claude→OpenAI/Gemini：删除 thinking 和 redacted_thinking 块，剥离 tool_use 块中的签名字段
- OpenAI→Claude/Gemini：从消息中删除 reasoning_content
- Gemini→Claude/OpenAI：删除 safetyRatings、thoughtSignatures、groundingMetadata
- 相同 provider：无操作

## 关系
### 调用 / 引用
- `../types.js` — `ApiType`
- `../logger.js` — 日志

### 提供
- `sanitizeMessages(messages, sourceProvider, targetProvider)` — 清理消息数组，返回 `{ messages, report }`
- `sanitizeRequestBodyMessages(body, sourceProvider, targetProvider)` — 清理请求体中的消息（便捷包装器）
- `SanitizeReport` 接口 — 字符串形式的结果报告

### 被依赖
- `proxy-routes.ts`

## 关键词
### 接口
- `SanitizeReport`

### 函数
- `sanitizeMessages`
- `sanitizeRequestBodyMessages`
- `sanitizeAnthropicContent`
