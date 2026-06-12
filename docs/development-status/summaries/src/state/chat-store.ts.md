# `src/state/chat-store.ts`

## 功能
Zustand 对话状态 store。管理对话列表、活跃对话 ID、输入草稿、历史统计、加载状态、待处理图片、AbortController。

**近期变更（2026-06-12）**：移除死字段 `chatSummarySnapshot` 和 `setChatSummarySnapshot`（零处外部调用，实际使用由 `useConversation.ts` 局部计算）。

## 关系
### 引用
- `src/state/types.ts` — `ChatStorageHistoryStats`, `Conversation`, `ConversationDrafts`, `PendingImageAttachment`, `EMPTY_HISTORY_STATS`

### 提供
- `useChatStore` — Zustand hook + store

### 被依赖
- `src/hooks/useAssistant.ts` — `setAbortController`, import
- `src/hooks/useConversation.ts` — import
- `src/App.tsx` — store 选择器
- `src/hooks/useChatUI.ts` — import
- `src/hooks/useConversationDrawer.ts` — import
- `src/hooks/useDeleteConfirmation.ts` — import

## 关键词
### 接口
- `ChatStore` — store 类型定义（状态 + actions）

### 函数（actions）
- `setConversations`, `setActiveConversationId`, `setDraftsByConversation`, `setConversationDraft`
- `setHistoryStats`, `setChatStateLoadError`, `setChatStateLoaded`
- `setPendingImages`, `removePendingImage`
- `setAbortController`
- `updateConversation`
