# `src/hooks/useConversation.ts`

## 功能
对话管理 hook。管理对话 CRUD、水合、持久化、图片水合、图片压缩。提取自 `src/App.tsx`。

**近期清理（2026-06-12）**：移除重复的手势交互代码（已由 `useConversationDrawer` 接管）和重复的标题编辑代码（已由 `useTitleTransition` 接管）。移除导致 #081 白屏崩溃的死 effect。

**2026-06-12 白屏修复**：未提交的变更重新添加了手势交互代码和标题编辑代码（与 `useConversationDrawer.ts` / `useTitleTransition.ts` 重复）。修复了两处 `g?.longPressTimerId !== null` 空值检查——当 `g` 为 `null` 时 `g?.longPressTimerId` 返回 `undefined`，`undefined !== null` 为 `true`，导致在 `null` 上访问 `longPressTimerId` 崩溃。改为 `g && g.longPressTimerId !== null`。

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
- `src/utils/images.ts` — 图片压缩
- `src/services/homepage-highlights.ts` — 主页统计

### 提供
- `useConversation` — 返回对话状态、计算属性（activeConversation、conversationGroups、tokenSummary 等）、CRUD 函数、Transcript 更新函数、图片管理函数

### 被依赖
- `src/App.tsx` — 主要消费者，解构使用 14 个计算属性 + 函数

## 关键词
### 函数
- `useConversation` — hook 主函数
- `setConversationsState` — 封装的 state setter
- `switchConversation` / `createNewConversation` — 对话切换/创建
- `deleteConversation_` — 对话删除
- `updateConversationDraft` / `updateConversationTranscript` / `updateConversationResponseMode` / `updateConversationTitle` — 更新帮助器
- `appendConversationTranscriptEvents` / `updateAssistantEvent` — Transcript 操作
- `hydrateConversationByIdImpl` — 对话水合
- `removePendingImage` / `updatePendingImageCompression` — 图片管理
