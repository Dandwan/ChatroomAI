# `src/utils/app-images.ts`

## 功能
图片查看器相关的工具函数。包括图片查看器键构建、ImageViewerItem 转换、对话图片项收集、以及图片存储键分配。

从 `src/App.tsx` 模块级代码中提取。

## 关系
### 调用 / 引用
- `src/components/ImageViewer.tsx` — 导入 `ImageViewerItem` 类型
- `src/state/types.ts` — 导入 `ChatMessage`、`ImageAttachment`、`PendingImageAttachment`、`Conversation`

### 提供
- `buildMessageImageViewerKey`、`buildPendingImageViewerKey`
- `toImageViewerItem`、`collectConversationImageViewerItems`
- `applyAssignedImageStorageKeys`

### 被依赖
- `src/App.tsx` — （计划导入，当前仍使用内联定义）

## 关键词
### 函数
- `buildMessageImageViewerKey`、`buildPendingImageViewerKey`
- `toImageViewerItem`
- `collectConversationImageViewerItems`
- `applyAssignedImageStorageKeys`
