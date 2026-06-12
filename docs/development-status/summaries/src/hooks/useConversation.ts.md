# `src/hooks/useConversation.ts`

## 功能
对话管理 hook。管理对话 CRUD、水合、持久化、图片水合、手势交互和标题编辑。提取自 `src/App.tsx`。

**近期修复（2026-06-12）**：修复 `longPressTimerId` 空值检查导致应用白屏的问题（#560）。手势交互逻辑已由 `useConversationDrawer` 接管，此文件中的手势代码为重复死代码，待 Phase 2 步骤 8 完整去重。

## 关系
### 调用 / 引用
- `src/state/chat-store.ts` — `useChatStore`（对话状态）
- `src/state/settings-store.ts` — `useSettingsStore`（设置）
- `src/state/ui-store.ts` — `useUIStore`（UI 状态）
- `src/services/chat-storage.ts` — 持久化、水合、索引
- `src/services/chat-transcript.ts` — 消息投影
- `src/utils/app-module.ts` — 对话工厂函数
- `src/utils/app-formatting.ts` — 格式化
- `src/utils/app-images.ts` — 图片键管理
- `src/services/homepage-highlights.ts` — 主页统计

### 提供
- `useConversation` — 返回对话状态、计算属性、CRUD 函数、手势 handler、标题编辑函数

### 被依赖
- `src/App.tsx` — 计划使用（待集成）

## 关键词
### 函数
- `useConversation` — hook 主函数
- `setConversationsState` — 封装的 state setter
- `switchConversation` / `createNewConversation` — 对话切换/创建
- `deleteConversation_` — 对话删除
- `updateConversationDraft` / `updateConversationTranscript` — 更新帮助器
- `handleConversationPointerDown/Move/Up/Cancel` — 手势交互
- `beginRenameConversation` / `cancelRenameConversation` / `saveRenameConversation` — 标题编辑
