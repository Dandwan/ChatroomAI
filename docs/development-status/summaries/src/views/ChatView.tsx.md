# `src/views/ChatView.tsx`

## 功能
消息列表渲染组件。从 App.tsx 提取（E2 阶段），替代原来的 `activeMessages.map(...)` 内联回调。包含消息卡片渲染、推理面板（reasoning-panel）、助理流程内联渲染（assistant-inline-flow）、ThinkingPhrase 加载态、编辑模式 UI、Token 使用量指标、消息操作按钮。

## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — useUIStore（editingMessageId, editingText, openReasoningByMessage, openSkillResultByStep）
- `src/state/types.ts` — AppSettings, ChatMessage, ProviderConfig 类型
- `src/utils/assistant-flow.ts` — formatSkillStepTarget, formatSkillStepStatus, AssistantFlowNode, AssistantFlowSkillNode
- `src/utils/text-utils.ts` — stripSkillParsingHintLines
- `src/utils/time-utils.ts` — formatMs
- `src/utils/app-images.ts` — buildMessageImageViewerKey
- `src/services/actinet-models.ts` — getEffectiveActiNetModels
- `src/utils/app-module.ts` — ACTINET_PROVIDER_NAME
- `src/components/MarkdownMessage.tsx` — Markdown 渲染
- `src/components/ChatInputBox.tsx` — 编辑模式输入框
- `src/components/ThinkingPhrase.tsx` — 加载态短语

### 提供
- `ChatView` — 消息列表渲染组件
- `ChatViewProps` — 组件 props 类型

### 被依赖
- `src/App.tsx` — 替代 activeMessages.map() 回调块
