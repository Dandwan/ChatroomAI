# `src/hooks/useAssistantStream.ts`

## 功能
辅助流式 delta 处理 hook。管理 RAF 批处理、流式 delta 队列、debug 日志、assistant flow 状态更新。从 `src/App.tsx` 提取（Phase 2 深度精简 — 步骤 1）。

## 关系
### 调用 / 引用
- `src/utils/assistant-flow.ts` — `appendAssistantFlowContent`, `appendAssistantFlowDivider`, `assistantFlowToPlainText`, `clearAssistantFlowRound`, `AssistantFlowNode`
- `src/utils/app-debug.ts` — `truncateDebugLogText`, `appendDebugLogEntry`, debug 常量
- `src/utils/app-formatting.ts` — `createId`
- `src/services/chat-transcript.ts` — `AssistantMessageTranscriptEvent`

### 提供
- `useAssistantStream` — 返回流式 delta 处理函数（append/apply/flush/reset）和 flow 更新函数

### 被依赖
- `src/App.tsx` — 传入 `updateAssistantEvent` 回调

## 关键词
### 函数
- `useAssistantStream` — hook 主函数
- `appendSkillRoundLog` / `appendObjectFlowLog` — debug 日志
- `applyAssistantStreamDelta` — 将 delta 应用到转录事件
- `appendAssistantStreamDelta` — 入队 + RAF 批处理
- `flushQueuedAssistantStreamDelta` — 刷新队列
- `resetAssistantStreamOutput` — 重置输出
- `updateAssistantFlow` — 更新 assistant flow 节点
- `appendAssistantFlowRoundDivider` / `clearAssistantFlowRoundState` — 轮次管理
