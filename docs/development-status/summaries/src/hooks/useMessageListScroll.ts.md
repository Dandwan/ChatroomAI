# `src/hooks/useMessageListScroll.ts`

## 功能
消息列表滚动管理 hook。管理自动滚动、平滑滚动、滚动指标、ResizeObserver insets 计算、用户交互检测。从 `src/App.tsx` 提取（Phase 2 深度精简 — 步骤 3）。这是最大的单一提取（~500 行）。

## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — `useUIStore`（滚动指标、insets、auto-follow 状态）
- `src/state/types.ts` — `ChatMessage`, `MessageListScrollMetrics`
- `src/utils/app-module.ts` — `MESSAGE_LIST_*` 常量、`resolveMessageListSmoothScrollStep`

### 提供
- `useMessageListScroll` — 返回滚动事件处理函数、滚动方法、insets 数据

### 被依赖
- `src/App.tsx` — 传入外部 DOM refs、`showScrollToBottomButton`/`hideScrollToBottomButton` 回调、对话/消息数据

## 关键词
### 函数
- `useMessageListScroll` — hook 主函数
- `scrollMessageListToBottom` / `smoothScrollMessageListToBottom` — 滚动方法
- `onScroll` / `onPointerDownCapture` / `onPointerUpCapture` / `onPointerCancelCapture` / `onWheelCapture` — 事件处理
- `handleScrollToBottomButtonClick` — 回到底部按钮
- `getMessageListScrollMetrics` / `syncMessageListScrollMetrics` — 指标计算/同步
- `beginMessageListInteraction` / `scheduleMessageListInteractionEnd` — 交互计时
- ResizeObserver effect — 滚动 insets 计算（~85 行）
