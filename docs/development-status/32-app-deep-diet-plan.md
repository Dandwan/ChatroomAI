# App.tsx 深度精简方案 — 第二阶段

**日期**：2026-06-11
**来源**：基于 `31-app-modular-refactor-status.md` + 完整代码静态分析
**目标**：App.tsx 3,191 → ~900 行（−2,300 行，−72%）

---

## 一、上下文

App.tsx 模块化重构第一阶段（E1-E5+F）已提取全部 5 个 views 组件和 8 个 hooks。当前 App.tsx 3,191 行（−57.9%）。

**根因分析**：约 2,600+ 行内联业务逻辑仍散落在 App.tsx 中，分散在 6-7 个关注领域：

| 层次 | 行数范围 | 行数 | 特征 |
|------|---------|------|------|
| Store 选择器 + refs | 150–370 | ~220 | 状态管道 |
| useMemo（派生数据） | 408–702 | ~300 | 计算状态 |
| useCallback + 普通函数 | 371–2,227 | ~1,850 | 事件处理和副作用 |
| useEffect + useLayoutEffect | 2,229–2,871 | ~640 | 副作用 |
| JSX return（AppShell 调用） | 2,875–3,188 | ~310 | 含 ~150 个 props |

---

## 二、方案总览

创建 **6 个新的专用 hooks** + 扩展 1 个现有 hook + 清理死代码。

```
当前 3,191 行
  − Hook 4: useAssistantStream      (~200 行)
  − Hook 3: useTitleTransition      (~150 行)
  − Hook 1: useMessageListScroll    (~400 行)
  − Hook 5: useSettingsNavigation   (~120 行)
  − Hook 6: useDeleteConfirmation   (~80 行)
  − Hook 2: useConversationDrawer   (~350 行)
  − 扩展 useChatUI                   (~30 行)
  − 死代码清理                       (~50 行)
─────────────────────────────────────────
目标 ~900 行（−2,300 行，−72%）
```

---

## 三、各 Hook 详细设计

### Hook 1: `useMessageListScroll`（最高优先级）

**文件**：`src/hooks/useMessageListScroll.ts`
**估计行数**：~400 行移出 App.tsx
**优先级**：最高 — 最大的单一代码块，完全自包含

**内容**：所有消息列表滚动相关的逻辑

**捕获的 Refs（12 个）**：
- messageListRef, chatContentStackRef, chatHeaderRef, chatSummaryBarRef, composerFooterRef
- messageListInteractionTimerRef, messageListUserInteractingRef
- messageListProgrammaticScrollRef, messageListProgrammaticScrollAnimationFrameRef
- messageListSmoothScrollAnimationFrameRef, messageListSmoothScrollInProgressRef
- pendingMessageListBottomResetRef

**捕获的 useCallback（10 个）**：
- handleMessageListScroll — 滚动事件处理
- handleMessageListPointerDownCapture / UpCapture / CancelCapture — 指针事件
- handleMessageListWheelCapture — 滚轮事件
- handleScrollToBottomButtonClick — 回到底部按钮
- scrollMessageListToBottom — 即时滚动到底部
- smoothScrollMessageListToBottom — 平滑滚动到底部
- beginMessageListInteraction / scheduleMessageListInteractionEnd — 交互计时
- getMessageListScrollMetrics / syncMessageListScrollMetrics — 指标计算
- isMessageListAtBottom / trackProgrammaticMessageListScroll — 位置跟踪
- cancelMessageListSmoothScroll / clearProgrammaticMessageListScrollTracking
- clearMessageListInteractionTimer — 清理

**捕获的 useEffect/useLayoutEffect（8 个）**：
- 自动滚动 on messages change（useLayoutEffect）
- 滚动指标同步（useLayoutEffect）
- 滚动 insets ResizeObserver（useLayoutEffect，85 行）
- 滚动到底部按钮可见性（useEffect）
- 窗口 resize（useEffect）
- 活跃对话变更重置（useEffect）
- 清理效果（4 个 useEffect）

**捕获的 useMemo（1 个）**：
- shouldShowScrollToBottomButton

**参数签名**：
```typescript
function useMessageListScroll(
  pushNotice: (text: string, type?: 'info' | 'success' | 'error') => void,
  activeConversationId: string,
  activeMessages: ChatMessage[],
  hasActiveMessages: boolean,
  isHomepageEmptyState: boolean,
  isSending: boolean,
  showScrollToBottomButton: (rAF: boolean) => void,
  hideScrollToBottomButton: (rAF: boolean) => void,
)
```

**返回值**：
```typescript
{
  // 传递给 main.message-list 的事件处理
  messageListRef, chatContentStackRef,
  onScroll, onPointerDownCapture, onPointerUpCapture,
  onPointerCancelCapture, onWheelCapture,
  // 传递给 ComposerView
  handleScrollToBottomButtonClick,
  // 传递给 ChatScrollPlaceholder
  activeChatScrollInsets,
  // 传递给 AppShell（通过 contentElement）
  shouldShowScrollToBottomButton,
}
```

---

### Hook 2: `useConversationDrawer`（高优先级）

**文件**：`src/hooks/useConversationDrawer.ts`
**估计行数**：~350 行移出 App.tsx

**内容**：抽屉中对话列表的手势交互、滑动删除、分组管理、对话删除确认

**捕获的 Refs（6 个）**：
- conversationListRef, conversationGroupElementRefs, drawerScrollTopRef
- conversationSwipeStartRef, ignoreNextConversationClickRef
- hasAutoCollapsedConversationGroupsRef, deleteConfirmBypassUntilRef

**捕获的 useMemo（3 个）**：
- visibleConversations, sortedConversations, conversationGroups

**捕获的函数（15 个）**：
- switchConversation, createNewConversation
- clearConversationGestureTimer, resetConversationSwipe
- toggleDeleteMode, toggleConversationGroup
- extendDeleteConfirmGrace
- deleteConversation, confirmDeleteConversation
- confirmDeleteProvider, confirmDeleteSkill, confirmDeleteRuntime
- requestDeleteConversation
- handleConversationPointerDown, handleConversationPointerMove
- handleConversationPointerUp, handleConversationPointerCancel
- handleConversationClick

**捕获的副作用（5 个）**：
- 抽屉挂载清理（useEffect）
- 折叠分组同步（useEffect）
- 自动折叠重置（useEffect）
- 自动折叠可见性（useEffect，55 行，rAF 双包装）
- 抽屉滚动恢复（useLayoutEffect）

**注意**：现有 `useConversation` hook 已有 handleConversationPointer* 简化版和 toggleConversationGroup。新 hook 提供完整版本（含 deleteConfirmBypassUntilRef、swipe 状态等）。在两个 hook 之间通过 App.tsx 传递共享的状态。

**参数签名**：
```typescript
function useConversationDrawer(
  pushNotice: (text: string, type?: 'info' | 'success' | 'error') => void,
  conversations: Conversation[],
  activeConversationId: string,
  // 来自 conv hook
  conv: ReturnType<typeof useConversation>,
  // 外部依赖
  cancelEdit: () => void,
  stopRenameConversationImmediately: () => void,
  closeModelMenu: () => void,
  openDeleteDialog: (dialog: any) => void,
)
```

---

### Hook 3: `useTitleTransition`（中优先级）

**文件**：`src/hooks/useTitleTransition.ts`
**估计行数**：~150 行移出 App.tsx

**内容**：对话标题重命名的动画过渡（Rect 快照 + FLIP 动画）

**捕获的 Refs（8 个）**：
- titleTextRef, titleRenameButtonRef, titleInputRef, titleActionsRef
- titleTransitionPrepRef, titleTransitionAnimationFrameRef, titleTransitionTimerRef

**捕获的函数（7 个）**：
- clearTitleTransitionTimers — 动画清理
- playTitleTransition — FLIP 过渡播放
- stopRenameConversationImmediately — 硬停止
- focusTitleInput — 聚焦标题输入框
- beginRenameConversation — 开始重命名（含 Rect 快照）
- cancelRenameConversation — 取消
- saveRenameConversation — 保存

**捕获的副作用（2 个）**：
- 标题过渡动画（useLayoutEffect，50 行）
- 标题输入聚焦（useEffect）

**注意**：useChatUI 已有简化版 beginRenameConversation/cancelRenameConversation/saveRenameConversation。新 hook 提供完整版本（含 Rect 快照动画）。App.tsx 将使用新 hook 的版本。

---

### Hook 4: `useAssistantStream`（中优先级）

**文件**：`src/hooks/useAssistantStream.ts`
**估计行数**：~200 行移出 App.tsx

**内容**：辅助流式 delta 的 RAF 批处理和队列管理

**捕获的 Refs（6 个）**：
- queuedAssistantStreamDeltaRef, queuedAssistantStreamDeltaAnimationFrameRef
- lastSkillRoundLogKeyRef, lastObjectFlowLogKeyRef
- queuedTurnExecutionsRef, processingTurnQueueRef

**捕获的函数（8 个）**：
- appendAssistantStreamDelta — 入队 + RAF 批处理（60 行）
- applyAssistantStreamDelta — 应用到转录（80 行）
- flushQueuedAssistantStreamDelta — 刷新队列
- resetAssistantStreamOutput — 重置输出
- applyAssistantFlowState — 流程状态更新
- updateAssistantFlow — 流程节点更新
- appendAssistantFlowRoundDivider — 轮次分隔符
- clearAssistantFlowRoundState — 轮次清理

**捕获的副作用（1 个）**：
- 队列清理 on unmount（useEffect）

**参数签名**：
```typescript
function useAssistantStream(
  settings: AppSettings,
  // 转录更新回调
  updateConversationTranscript: (id: string, transcript: TranscriptEvent[]) => void,
)
```

---

### Hook 5: `useSettingsNavigation`（低-中优先级）

**文件**：`src/hooks/useSettingsNavigation.ts`
**估计行数**：~120 行移出 App.tsx

**内容**：设置页面导航、视图切换、滚动位置记忆、抽屉→设置过渡

**捕获的 Refs（3 个）**：
- settingsScrollByViewRef, settingsPageRef, openSettingsAfterDrawerTimerRef

**捕获的函数（9 个）**：
- openSettingsHome — 打开设置主页
- openSettingsFromDrawer — 从抽屉打开（延迟过渡）
- clearOpenSettingsAfterDrawerTimer — 清理过渡定时器
- rememberSettingsScrollPosition — 记下当前滚动位置
- navigateSettingsView — 切换设置视图
- openProviderDetail — 打开服务商详情
- handleSettingsBack — 返回上一级
- closeSettingsPanel — 关闭面板
- onSettingsScroll — 设置页面滚动事件

**捕获的副作用（2 个）**：
- 设置滚动恢复（useLayoutEffect）
- 抽屉→设置定时器清理（useEffect）

---

### Hook 6: `useDeleteConfirmation`（低优先级）

**文件**：`src/hooks/useDeleteConfirmation.ts`
**估计行数**：~80 行移出 App.tsx

**内容**：统一的删除确认弹窗逻辑（对话/服务商/技能/运行时）

**捕获的函数（5 个）**：
- closeDeleteDialog
- confirmDeleteConversation — 删除对话
- confirmDeleteProvider — 删除服务商
- confirmDeleteSkill — 删除技能
- confirmDeleteRuntime — 删除运行时
- extendDeleteConfirmGrace — 延长确认宽限期

**捕获的副作用（1 个）**：
- 删除弹窗有效性检查（useEffect）

---

### 扩展: `useChatUI` 模型菜单外部点击

当前 useChatUI 缺少模型菜单外部点击关闭逻辑（~30 行 useEffect）。直接在 `useChatUI.ts` 中添加。

### 死代码清理

App.tsx 中约 25 个 void 语句标记的变量和约 10 个 void-cast 的函数。所有 hooks 迁移完成后移除：

| 类别 | 数量 | 处理方式 |
|------|------|---------|
| Void 变量（E1 标记） | ~15 | 移入对应 hook 或删除 |
| Void 函数定义 | ~10 | 移入对应 hook |
| 未使用导入 | ~10 | 删除 import 行 |

---

## 四、执行顺序与依赖

```
1. Hook 4: useAssistantStream         独立性强，无外部依赖
2. Hook 3: useTitleTransition         依赖 App.tsx refs，较独立
3. Hook 1: useMessageListScroll       最大代码块，独立
4. Hook 5: useSettingsNavigation      依赖 useSettings 返回值
5. Hook 6: useDeleteConfirmation      依赖多个 hooks
6. Hook 2: useConversationDrawer      最复杂，依赖最多
7. 扩展 useChatUI + 死代码清理        收尾
```

## 五、验证

每个 hook 完成后：
```bash
npx tsc -b --noEmit    # TypeScript: 目标 0 错误
npx vitest run          # Vitest: 目标 39 passed
wc -l src/App.tsx       # 确认行数递减
```

## 六、约束与权衡

### 会做
- 创建 6 个新的专用 hooks
- 扩展现有 useChatUI
- 将 ~1,300 行内联代码迁移到 hooks
- 清理 void 死代码
- 更新所有受影响文件的摘要
- 更新 `30-current-state`、`31-app-modular-refactor-status`、`00-index`
- 创建 handoff update 079

### 不会做
- 不修改现有 hooks 的公共接口
- 不修改任何 views 组件
- 不改变业务逻辑行为
- 不修复 `npm run build`（预存问题）
- 不将 useConversation 从命名空间切换为解构

### 关键风险

| 风险 | 缓解 |
|------|------|
| useConversationDrawer 与 useConversation 有重复函数 | 两个 hooks 共存，通过 App.tsx 传递共享状态 |
| useTitleTransition 与 useChatUI 标题状态重复 | 新 hook 处理动画，useChatUI 保留基础状态 |
| Ref 所有权 — hooks 不能拥有 refs | 所有 refs 仍由 App.tsx 用 useRef 创建，通过参数传入 |
| 大规模迁移可能引入回归 | 每完成 1 个 hook 后 tsc + vitest 验证 |

### 现实目标

App.tsx 作为应用根组件，天然需要保留：
- Store 初始化（~30 行）
- Store 选择器（~100 行）
- Hooks 调用组装（~80 行）
- 计算属性派生（~100 行）
- AppShell JSX 组装（~500 行，含 props）

**第二阶段目标：~900 行**。要更进一步，需要第三阶段（解构 useConversation、创建 useAppInit、压缩 AppShell props）。

---

## 七、关联文档

| 文档 | 内容 |
|------|------|
| `31-app-modular-refactor-status.md` | 第一阶段重构状态（已全部完成） |
| `handoff-updates/078-*.md` | E2-E5+F 完成报告 |
| `handoff-updates/070-*.md` | 原始重构方案 |
| `handoff-updates/069-*.md` | 阶段 1 工具函数提取 |
