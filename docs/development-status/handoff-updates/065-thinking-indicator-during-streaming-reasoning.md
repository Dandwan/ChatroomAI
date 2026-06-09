# 065 — 流式思考期间保持思考状态显示

**日期**：2026-06-09

## 范围

修复流式对话中思考状态指示器过早消失的问题：当模型开始流式返回 reasoning（思考）内容时，`ThinkingPhrase` 组件（趣味短语+计时器）不应消失，应继续计时直到正文内容开始到达。

## 根因

`src/App.tsx` L9374-9375，`isAssistantLoading` 条件中包含 `!hasReasoning`：

```typescript
const isAssistantLoading =
  message.role === 'assistant' && !message.error && !textValue && !hasReasoning && !hasAssistantFlow
```

一旦 streaming 返回任何 reasoning 内容，`hasReasoning` 变为 `true`，`isAssistantLoading` 立即变为 `false`，`ThinkingPhrase` 消失。

## 变更的代码区域

### 修改：`src/App.tsx` L9374-9375

移除 `!hasReasoning` 条件：

```typescript
// 旧
message.role === 'assistant' && !message.error && !textValue && !hasReasoning && !hasAssistantFlow

// 新
message.role === 'assistant' && !message.error && !textValue && !hasAssistantFlow
```

流式阶段行为变化：

| 阶段 | 旧行为 | 新行为 |
|------|--------|--------|
| 等待响应 | `ThinkingPhrase` 计时 | 不变 |
| 流式思考中 | `ThinkingPhrase` ✗，仅推理面板 | `ThinkingPhrase` + 推理面板 ✓ |
| 流式正文中 | 正文内容 | 不变 |

## Files Touched

- `src/App.tsx` — 移除 `isAssistantLoading` 中的 `!hasReasoning`（1 行）
- `docs/development-status/summaries/src/App.tsx.md` — 近期变更更新

## Validation

- `npx tsc -b --noEmit` — ✅ 通过
- `npx vite build` — ✅ 通过（319ms）
- ⚠️ `npm run build` 中 `skill:sync:builtin` 预存失败（`runtime-shell` 目录缺失），与本次变更无关

## 决策关卡

- 方案已提出 + 用户确认：是

## 下一步

- 真机验证：使用支持 thinking 的模型（如 Claude）发送消息，观察思考内容流式到达时 `ThinkingPhrase` 是否持续计时，思考面板是否同步展示
