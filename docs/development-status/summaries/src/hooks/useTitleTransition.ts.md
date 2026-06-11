# `src/hooks/useTitleTransition.ts`

## 功能
对话标题重命名动画 hook。管理 FLIP 过渡动画、Rect 快照、标题编辑状态（isEditingTitle/titleDraft/titleTransition）。从 `src/App.tsx` 提取（Phase 2 深度精简 — 步骤 2）。

## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — `useUIStore`（标题编辑状态）
- `src/state/types.ts` — `Conversation`, `PendingTitleTransition`, `TitleTransitionState`
- `src/utils/app-module.ts` — `getTravelOffset`, `shiftRect`, `snapshotRect`, `TITLE_EDIT_TRANSITION_MS`

### 提供
- `useTitleTransition` — 返回标题编辑函数和状态

### 被依赖
- `src/App.tsx` — 传入外部 refs、activeConversation、pushNotice、updateConversationTitle

## 关键词
### 函数
- `useTitleTransition` — hook 主函数
- `beginRenameConversation` — 开始重命名（含 Rect 快照）
- `cancelRenameConversation` — 取消（含关闭动画快照）
- `saveRenameConversation` — 保存（含关闭动画快照）
- `stopRenameConversationImmediately` — 硬停止
- `focusTitleInput` — 聚焦标题输入框
- `playTitleTransition` — 播放 FLIP 过渡
- `clearTitleTransitionTimers` — 清理动画定时器
