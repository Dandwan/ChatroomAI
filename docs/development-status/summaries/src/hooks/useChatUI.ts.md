# `src/hooks/useChatUI.ts`

## 功能
Chat UI 交互处理 hook。封装抽屉、菜单、图片查看器、滚动按钮、剪贴板等 UI 交互的处理函数。

从 `src/App.tsx` 的 UI 交互逻辑中提取。

## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — 导入 `useUIStore` 管理 UI 状态
- `src/state/types.ts` — 导入相关类型

### 提供
- `useChatUI` hook — 返回所有 UI 交互处理函数

### 被依赖
- `src/App.tsx` — （计划使用）

## 关键词
### 函数
- `useChatUI` — hook 主函数
- `openDrawer`、`closeDrawer`
- `openModelMenu`、`closeModelMenu`
- `openSettings`、`closeSettings`
- `showImageViewerOverlay`、`hideImageViewerOverlay`、`openImageViewer`、`closeImageViewer`
- `showScrollToBottomButton`、`hideScrollToBottomButton`
- `copyTextToClipboard`
- `openDeleteDialog`
