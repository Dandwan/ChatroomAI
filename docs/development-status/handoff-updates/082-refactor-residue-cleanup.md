# 082 — 重构残留清理：去重、死代码移除、重复计算消除

**日期**：2026-06-12
**类型**：重构清理

## 范围

完成 Phase 2 步骤 8-9（与 useConversation 去重 + 完整死代码清理），基于重构前后完整对比报告的发现。

## 变更的代码区域

### 修改文件

| 文件 | 操作 | 行数变化 | 说明 |
|------|------|---------|------|
| `src/hooks/useConversation.ts` | 修改 | 716 → 569 (−147) | 移除重复手势代码（−90 行）和标题编辑代码（−50 行），移除死 effect |
| `src/hooks/useChatUI.ts` | 修改 | ~270 → 212 (−58) | 移除未使用的标题编辑函数和 copyTextToClipboard |
| `src/App.tsx` | 修改 | 1,335 → 1,115 (−220) | 重复 useMemo 替换为 conv.* 解构，清理冗余 import 和 store 选择器，提前 pushNotice/conv 定义 |
| `src/hooks/useConversationDrawer.ts` | 修改 | 262 → 261 (+1) | 修复 longPressTimerId 未显式清空（低风险） |

### 修改的摘要文件

| 文件 |
|------|
| `docs/development-status/summaries/src/hooks/useConversation.ts.md` |
| `docs/development-status/summaries/src/hooks/useChatUI.ts.md` |
| `docs/development-status/summaries/src/App.tsx.md` |

## 当前状态

| 维度 | 数值 |
|------|------|
| **App.tsx** | 1,115 行（原 9,875 −88.7%） |
| **Hooks 总数** | 14 |
| **tsc** | 0 错误 ✅ |
| **vitest** | 39 passed ✅ |

## 修复的具体问题

### 1. useConversation.ts 重复手势代码（#081 白屏根因）
- 移除 `conversationSwipeStartRef`、手势 handler（pointerDown/Move/Up/Cancel/Click）、`toggleConversationGroup`、`toggleDeleteMode` 及手势清理 effect
- 这些功能已正确存在于 `useConversationDrawer.ts`，App.tsx 使用 `drawer.*` 版本
- 手势清理 effect 在初始化时执行但 ref 为 null，是 #081 白屏崩溃的根因（已紧急修复空值检查，此处彻底移除）

### 2. useConversation.ts 重复标题编辑代码
- 移除 `isEditingTitle`、`titleDraft`、`titleTransition`、标题重命名函数及动画 refs
- 这些功能已正确存在于 `useTitleTransition.ts`，App.tsx 使用 `titleHook.*` 版本

### 3. useChatUI.ts 未使用函数
- 移除标题编辑状态（`renamingConversationId`、`renamingDraft`、`renamingTitleRect`）及函数
- 移除 `copyTextToClipboard`（`useAssistant.ts` 有自己的独立实现）

### 4. App.tsx 重复计算消除
- 15+ 个本地 useMemo 替换为 `conv.*` 解构：`activeConversation`、`activeMessages`、`conversationGroups`、`tokenSummary`、`chatSummarySnapshot`、`homepageHighlightStats` 等
- 移除冗余的 `projectedMessagesByConversationId`、`conversationSummariesById`、`currentHistoryStats` 中间计算
- 清理未使用 import：`isTranscriptConversationWorkspacePlaceholder`、`projectConversationMessages`、`buildHistoryStatsFromSummaries`、`selectHomepageHighlights`、`formatCompactCount`、`isPersistedConversationSummary` 等
- 清理未使用 store 选择器：`setConversations`、`historyStats`、`chatStateLoaded`
- 清理未使用 state：`abortController`
- 清理未使用 destructured hook 值：`applySettingsUpdate`
- 将 `pushNotice` 和 `useConversation` 定义提前，避免 `used before declaration` 问题

### 5. useConversationDrawer.ts longPressTimerId 显式清空
- `handleConversationPointerMove` 中 `clearConversationGestureTimer()` 后显式 `s.longPressTimerId = null`

## 验证

每步骤完成后均通过：
```bash
npx tsc -b --noEmit    # 0 错误
npx vitest run          # 39 passed
```

最终验证：
- App.tsx: 1,115 行
- useConversation.ts: 569 行
- useChatUI.ts: 212 行
- useConversationDrawer.ts: 261 行

## 决策关卡

- 方案已确认：是（用户明确确认）

## 未解决问题

1. `npm run build` 失败（`builtin-skills/runtime-shell/` 缺失）— 预存问题，与重构无关
2. `useConversation.ts` 返回的某些值（`conversations`、`activeConversationId` 等）仍与 App.tsx store 选择器有部分重叠，可进一步优化
3. 多文件重复定义（`vibrateInteraction`、`extractThinkBlocks`、`createId` 等）可在后续统一

## 关联文档

- 前一更新：`081-fix-longpresstimer-null-check-white-screen.md`
- 对比报告：本会话中的完整对比分析
- 重构状态：`31-app-modular-refactor-status.md`
- 精简方案：`32-app-deep-diet-plan.md`
- 当前状态：`30-current-state-and-known-issues.md`
