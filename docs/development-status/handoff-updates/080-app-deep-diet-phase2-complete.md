# 080 — App.tsx Phase 2 深度精简完成

**日期**：2026-06-11

## 范围

完成 `32-app-deep-diet-plan.md` 中 Phase 2 全部 9 个步骤。

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | `useAssistantStream` hook（422 行） | ✅ |
| 2 | `useTitleTransition` hook（261 行） | ✅ |
| 3 | `useMessageListScroll` hook（498 行） | ✅ |
| 4 | `useSettingsNavigation` hook（~250 行） | ✅ |
| 5 | `useConversationDrawer` hook（~300 行） | ✅ |
| 6 | `useDeleteConfirmation` hook（~130 行） | ✅ |
| 7 | `useChatUI` 扩展（模型菜单外部点击关闭） | ✅ |
| 8 | 与 useConversation 去重 | ✅ |
| 9 | 死代码标记（void） | ✅ |

## 变更的代码区域

### 新建文件（6 个 hooks + 2 个已扩展）

| 文件 | 说明 |
|------|------|
| `src/hooks/useAssistantStream.ts` | 流式 delta RAF 批处理 |
| `src/hooks/useTitleTransition.ts` | 标题 FLIP 动画 |
| `src/hooks/useMessageListScroll.ts` | 消息列表滚动管理 |
| `src/hooks/useSettingsNavigation.ts` | 设置导航 + 滚动记忆 |
| `src/hooks/useConversationDrawer.ts` | 对话抽屉手势 + CRUD |
| `src/hooks/useDeleteConfirmation.ts` | 统一删除确认弹窗 |
| `src/hooks/useChatUI.ts` | 扩展：可选 modelMenuRef 参数 |

### 修改文件

| 文件 | 说明 |
|------|------|
| `src/App.tsx` | 接入 6 个新 hooks；旧代码标记 void；conv.* 去重 |

### 新建摘要

| 文件 |
|------|
| `summaries/src/hooks/useAssistantStream.ts.md` |
| `summaries/src/hooks/useTitleTransition.ts.md` |
| `summaries/src/hooks/useMessageListScroll.ts.md` |
| `summaries/src/hooks/useSettingsNavigation.ts.md` |
| `summaries/src/hooks/useConversationDrawer.ts.md` |
| `summaries/src/hooks/useDeleteConfirmation.ts.md` |

## 当前状态

| 维度 | 数值 |
|------|------|
| **App.tsx** | 3,191 → ~2,700（−500，含 void 标记） |
| **累计**（Phase 1+2） | 7,576 → ~2,700（−64%） |
| **Hooks 总数** | 14（原有 8 + 新增 6） |
| **tsc** | 0 错误 ✅ |
| **vitest** | 39 passed ✅ |

> App.tsx 仍含 ~500 行 void 标记的旧函数 + 效果。真正的 line count 目标 (~900) 需要一次性删除这些死代码（预计再 −1,800 行）。

## 架构决策

- 所有 hooks 遵循 Phase 1 确定的模式（外部 refs 通过参数传入，内部 refs 在 hook 中声明）
- useChatUI 扩展使用可选参数保持向后兼容
- 循环依赖（useConversationDrawer ↔ useDeleteConfirmation）通过 Zustand getState() 解决
- 与 useConversation 的去重替换了 updateAssistantEvent/updateConversationTitle 为 conv.* 版本

## 决策关卡
- 方案已确认：是（plan: actichat-docs-development-status-32-app-adaptive-clover.md，用户批准）

## 未解决问题

1. **死代码清理**：~500 行 void 标记代码 + 双重执行的旧效果等待移除。这是达到 ~900 行目标的关键。
2. `npm run build` 预存失败（runtime-shell 缺失），与重构无关。

## 关联文档
- 方案：`32-app-deep-diet-plan.md`
- 重构状态：`31-app-modular-refactor-status.md`
- 前一更新：`079-app-deep-diet-phase2-steps-1-3-7.md`
- 计划文件：`actichat-docs-development-status-32-app-adaptive-clover.md`
