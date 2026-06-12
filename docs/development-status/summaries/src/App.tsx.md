# `src/App.tsx`

## 功能
ActiChat 应用的主 shell 组件。通过 14 个 hooks + 5 个 views 组件完成渲染和交互。

**近期变更（2026-06-12）：重构残留清理**
- 移除 `useConversation.ts` 中重复的手势和标题编辑死代码（−147 行）
- 移除 `useChatUI.ts` 中未使用的标题编辑和 `copyTextToClipboard`（−58 行）
- App.tsx 重复计算替换为 `conv.*` 解构，移除冗余 import 和 store 选择器（−220 行）
- 修复 `useConversationDrawer.ts` 中 `longPressTimerId` 未清空问题
- App.tsx: 1,335 → 1,115 行（−16.5%）

**Phase 2 重构（2026-06-11）：6 个新 hooks 创建，App.tsx 从 7,576 → 2,684 行**
**Phase 1 重构（2026-06-11）：8 hooks + 5 views 提取，App.tsx 从 7,576 → 3,191 行**

## 关系
### 调用 / 引用
- `src/views/` — AppShell, SettingsPage, HomepageView, ComposerView, ChatView
- `src/components/` — ChatHeader, ChatScrollPlaceholder, ChatSummaryBar, AppDrawer, ImageViewer, DeleteConfirmationLayer, NoticeBanner, UpdateDialog, HomepageSendTransition, TitleTransition
- `src/hooks/` — useCloudAuth, useUpdates, useConversation, useExtensions, useSettings, usePermissions, useAssistant, useChatUI, useTitleTransition, useMessageListScroll, useSettingsNavigation, useConversationDrawer, useDeleteConfirmation
- `src/state/` — ui-store, chat-store, settings-store
- `src/utils/` — app-module, app-formatting

### 提供
- `App` — React 根组件（default export）

### 被依赖
- `src/main.tsx` — 入口文件渲染 App 组件

## 关键词
### 函数
- `App` — 应用主组件，组装 13 个 hooks + AppShell JSX
- `pushNotice` — 通知推送（提前定义供所有 hooks 和 computed values 使用）
- `beginEdit`、`saveAssistantEdit`、`saveUserEdit` — 消息编辑
- `toggleReasoning`、`toggleSkillResult` — UI toggle
