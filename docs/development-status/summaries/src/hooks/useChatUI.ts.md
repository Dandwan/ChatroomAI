# `src/hooks/useChatUI.ts`

## 功能
Chat UI 交互处理 hook。封装抽屉、模型菜单、设置面板、图片查看器、滚动按钮和删除确认弹窗等 UI 交互的处理函数。

**近期清理（2026-06-12）**：移除未使用的标题编辑函数和 `copyTextToClipboard`（`useAssistant` 有自己的实现）。新增模型菜单外部点击关闭功能。

## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — `useUIStore` 管理 UI 状态
- `src/state/chat-store.ts` — `useChatStore`（图片查看器需要）
- `src/state/types.ts` — 相关类型
- `src/services/chat-transcript.ts` — 消息投影
- `src/utils/app-images.ts` — 图片查看器工具

### 提供
- `useChatUI` hook — 返回 UI 交互处理函数（抽屉开关、菜单开关、设置开关、图片查看器开关、滚动按钮、删除确认弹窗）

### 被依赖
- `src/App.tsx` — 解构使用所有返回的函数

## 关键词
### 函数
- `useChatUI` — hook 主函数
- `openDrawer`、`closeDrawer`
- `openModelMenu`、`closeModelMenu`
- `openSettings`、`closeSettings`
- `openImageViewer`、`closeImageViewer`
- `showScrollToBottomButton`、`hideScrollToBottomButton`
- `openDeleteDialog`
