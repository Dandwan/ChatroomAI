# `src/state/ui-store.ts`

## 功能
Zustand UI 状态 store。管理抽屉、菜单、设置面板、图片查看器、删除对话框、标题过渡、通知、权限请求、滚动指标、安全区、composer ref 等 UI 状态。

**近期变更（2026-06-12）**：移除死字段 `chatSummarySnapshot` 和 `setChatSummarySnapshot`（与 `chat-store.ts` 重复定义，两处均零外部调用）。

## 关系
### 引用
- `src/state/types.ts` — `DeleteDialogState`, `HomepageSendTransitionState`, `ImageViewerState`, `MessageListScrollMetrics`, `Notice`, `PendingTitleTransition`, `PromptEditorKey`, `SettingsView` 等

### 提供
- `useUIStore` — Zustand hook + store

### 被依赖
- `src/App.tsx` — store 选择器（设置导航、滚动、过渡、权限等）
- `src/hooks/` — useAssistant, useChatUI, useConversation, useConversationDrawer, useDeleteConfirmation, useMessageListScroll, useSettings, useSettingsNavigation, useTitleTransition
- `src/views/` — SettingsPage, ComposerView, AppShell

## 关键词
### 接口
- `UIStore` — store 类型定义（状态 + actions）

### 函数（actions）
- UI 可见性：`setSettingsVisibility`, `setDrawerVisibility`, `setModelMenuVisibility`, `setImageViewerVisibility`
- 通知：`pushNotice`, `dismissNotice`
- 删除对话框：`openDeleteDialog`, `closeDeleteDialog`
- 标题过渡：`beginTitleTransition`, `endTitleTransition`
- 滚动：`setMessageListScrollMetrics`, `setIsAutoFollowEnabled`, `setActiveChatScrollInsets`
- 其他：`setActiveRequestConversationId`, `setSettingsView`, `navigateSettingsView`, `setProviderDetailTargetId`, `setEditingMessageId`, `setEditingText`, `setOpenReasoningByMessage`, `setOpenSkillResultByStep`, `setIsFetchingModelsByProviderId`, `setRequestingPermission`, `setRequestingPermissionByKey`, `setHomepageSendTransition`
