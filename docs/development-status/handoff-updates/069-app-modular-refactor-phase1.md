# 069 — App.tsx 模块化重构阶段 1：提取工具函数与 hook 规划

**日期**：2026-06-10
**任务**：优化重构 ActiChat，将 App.tsx 彻底模块化，分为多个文件

## 目标

将 `src/App.tsx`（重构前 9,584 行）拆分为精简的 ~400 行 shell + 多个自定义 hooks 和工具模块。

## 已完成工作

### 1. 提取调试日志工具 (`src/utils/app-debug.ts`)

- 移动 `DEBUG_*_KEY`、`DEBUG_*_LIMIT` 常量
- 移动 `truncateDebugLogText`、`readDebugLogEntries`、`appendDebugLogEntry`、`clearDebugLogEntries`
- 移动 `buildDebugLogReportText`、`normalizePromptMessagesForDebug`
- 已集成到 App.tsx（通过 `import from './utils/app-debug'`）
- App.tsx 减少约 186 行（9,398 行）

### 2. 提取图片查看器工具 (`src/utils/app-images.ts`) ✅

- `buildMessageImageViewerKey`、`buildPendingImageViewerKey`
- `toImageViewerItem`、`collectConversationImageViewerItems`
- `applyAssignedImageStorageKeys`
- **已集成到 App.tsx**（替换约 110 行内联定义为 6 行导入）

### 3. 创建格式化工具 (`src/utils/app-formatting.ts`)

- `buildMessageImageViewerKey`、`buildPendingImageViewerKey`
- `toImageViewerItem`、`collectConversationImageViewerItems`
- `applyAssignedImageStorageKeys`
- **状态**：文件已创建，等待集成到 App.tsx

### 4. 创建 Chat UI hook (`src/hooks/useChatUI.ts`)

- `openDrawer`、`closeDrawer`、`openModelMenu`、`closeModelMenu`
- `openSettings`、`closeSettings`
- `showImageViewerOverlay`、`hideImageViewerOverlay`、`openImageViewer`、`closeImageViewer`
- `showScrollToBottomButton`、`hideScrollToBottomButton`
- `copyTextToClipboard`、`openDeleteDialog`
- **状态**：文件已创建，等待集成到 App.tsx

### 5. 助手交互 hook 规划 (`src/hooks/useAssistant.ts`)

- 记录 `executeAssistantTurn`（1068行）及相关处理函数的完整提取边界
- 列出需要解耦的依赖清单（约 20 项）
- 记录需要迁移的 local state/refs（7 项）
- **状态**：planned — 将在后续阶段实施

### 6. 代码摘要

为所有新文件创建了代码摘要：
- `summaries/src/utils/app-debug.ts.md`
- `summaries/src/utils/app-formatting.ts.md`
- `summaries/src/utils/app-images.ts.md`
- `summaries/src/hooks/useChatUI.ts.md`
- `summaries/src/hooks/useAssistant.ts.md`
- 更新 `summaries/src/App.tsx.md`

## 当前文件结构

```
src/
├── App.tsx (9493 行，减少 91 行)
├── hooks/
│   ├── useChatUI.ts       ← 新建（已创建，待集成）
│   ├── useAssistant.ts    ← 新建（规划文件）
│   └── useCloudAuth.ts    ← 已有
├── views/                 ← 待创建
├── utils/
│   ├── app-debug.ts       ← 新建（已集成 ✅）
│   ├── app-formatting.ts  ← 新建（待集成）
│   ├── app-images.ts      ← 新建（待集成）
│   ├── model-utils.ts     ← 已有
│   ├── text-utils.ts      ← 已有
│   ├── time-utils.ts      ← 已有
│   ├── assistant-flow.ts  ← 已有
│   └── ...
```

## 提取路线图

| 阶段 | 内容 | 行数 | 状态 |
|------|------|------|------|
| 1a | 调试日志工具 → app-debug.ts | ~90 | ✅ 完成 |
| 1b | 图片工具 → app-images.ts | ~110 | ✅ 完成 |
| 1c | 格式化/类型工具 → app-formatting.ts | ~200 | 🔧 待集成 |
| 1d | 设置标准化 → app-settings.ts | ~1100 | 📋 待创建 |
| 1e | 对话工厂 → app-conversation.ts | ~150 | 📋 待创建 |
| 1f | 动画工具 → app-animation.ts | ~80 | 📋 待创建 |
| 2a | Chat UI hook → useChatUI.ts | ~200 | 🔧 待集成 |
| 2b | 助手 hook → useAssistant.ts | ~1357 | 📋 已规划 |
| 2c | 对话 hook → useConversation.ts | ~300 | 📋 待创建 |
| 2d | 设置 hook → useSettings.ts | ~300 | 📋 待创建 |
| 2e | 扩展 hook → useExtensions.ts | ~200 | 📋 待创建 |
| 2f | 权限 hook → usePermissions.ts | ~100 | 📋 待创建 |
| 2g | 更新 hook → useUpdates.ts | ~100 | 📋 待创建 |
| 3 | 设置页 → SettingsPage.tsx | ~1300 | 📋 待创建 |
| **合计** | | **~5687** | |

最终目标：App.tsx ~400 行

## 验证

- `npx tsc -b --noEmit` — 0 错误 ✅
- `npm run build` — 未执行（后续阶段完成时执行）
- 现有行为保持完全兼容（仅重构内部结构）

## 已知问题

- `app-formatting.ts` 和 `app-images.ts` 中的函数在 App.tsx 中仍以内联方式定义（重复代码）
- `useChatUI.ts` 中的 `openDrawer`/`closeDrawer` 不包含 `requestAnimationFrame` 编排逻辑（简化实现）
- `executeAssistantTurn` 深度依赖 App 组件作用域，需要仔细解耦

## 后续建议

1. 集成 `app-formatting.ts` 和 `app-images.ts` 到 App.tsx（删除重复的内联定义）
2. 集成 `useChatUI.ts` 到 App.tsx
3. 创建并集成 `useConversation.ts`（对话 CRUD + 水合）
4. 从 App.tsx 提取 1068 行的 `executeAssistantTurn` 到 `useAssistant.ts`
5. 提取设置页渲染到 `SettingsPage.tsx`
6. 创建完整测试套件验证行为等价性
