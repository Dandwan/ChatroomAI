# 079 — App.tsx 深度精简 Phase 2：步骤 1-3, 7 完成

**日期**：2026-06-11

## 范围

开始执行 `32-app-deep-diet-plan.md` 中的 Phase 2 深度精简方案。完成 4 个步骤：

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1 | `useAssistantStream` hook 创建+集成 | ✅ |
| 2 | `useTitleTransition` hook 创建+集成 | ✅ |
| 3 | `useMessageListScroll` hook 创建+集成 | ✅ |
| 7 | `useChatUI` 扩展（模型菜单外部点击关闭） | ✅ |
| 4-6 | useSettingsNavigation/useConversationDrawer/useDeleteConfirmation | ⏳ 待实施 |
| 8 | 与 useConversation 去重 | ⏳ 待实施 |
| 9 | 死代码清理（完整） | ⏳ 部分完成 |

## 变更的代码区域

### 新建文件（3 个 hooks）

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/hooks/useAssistantStream.ts` | 422 | 流式 delta RAF 批处理、debug 日志、assistant flow 状态 |
| `src/hooks/useTitleTransition.ts` | 261 | 标题重命名 FLIP 动画、Rect 快照、编辑状态管理 |
| `src/hooks/useMessageListScroll.ts` | 498 | 消息列表滚动、ResizeObserver insets、交互检测 |

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.tsx` | 修改 | 接入 3 个新 hooks + useChatUI 扩展；旧代码标记 void 待步骤 9 清理 |
| `src/hooks/useChatUI.ts` | 修改 | 添加可选 `modelMenuRef` 参数和外部点击关闭 effect |

### 新建摘要文件

| 文件 |
|------|
| `summaries/src/hooks/useAssistantStream.ts.md` |
| `summaries/src/hooks/useTitleTransition.ts.md` |
| `summaries/src/hooks/useMessageListScroll.ts.md` |

## 当前状态

| 维度 | 数值 |
|------|------|
| **App.tsx 行数** | 2,684（从 3,191 −507，−15.9%） |
| **tsc 错误** | **0** ✅ |
| **测试** | **39 passed** ✅（1 E2E 预存失败） |
| **Hooks 总数** | 11（原有 8 + 新增 3） |

> **注意**：App.tsx 中旧的消息列表滚动代码仍在运行（标记为 void），与 hook 中的新代码并行执行。完整的死代码清理（步骤 9）预计可再移除 ~500 行。

## 架构决策

### 提取模式
所有新 hooks 遵循与 Phase 1 相同的模式：
- **外部 refs**（用于 JSX ref 属性）通过参数从 App.tsx 传入
- **内部 refs**（定时器、动画帧、手势状态）在 hook 内部声明
- **Store 访问**：通过 `useXxxStore` selector 读取状态，通过返回值和 setter 暴露

### Hook 参数设计
- `useAssistantStream`：接受 `{ updateAssistantEvent }` 回调 → 返回流式函数
- `useTitleTransition`：接受外部 refs + activeConversation + callbacks → 返回编辑函数和状态
- `useMessageListScroll`：接受外部 DOM refs + UI callbacks + 数据 → 返回事件处理函数和 insets

### useChatUI 扩展策略
- `modelMenuRef` 作为**可选参数**添加，保持向后兼容
- 外部点击关闭 effect 在 hook 内部管理

## 验证

每个步骤完成后均通过：
```bash
npx tsc -b --noEmit    # 0 错误
npx vitest run          # 39 passed（1 E2E 预存失败）
```

## 决策关卡
- 方案已确认：是（plan: `actichat-docs-development-status-32-app-adaptive-clover.md`，用户批准）

## 未解决问题

1. **双重执行风险**：App.tsx 中旧的消息列表滚动 effects 仍与 hook 版本并行运行，浪费 CPU。需在步骤 9 中完整清理。
2. **步骤 4-6 待实施**：useSettingsNavigation、useConversationDrawer、useDeleteConfirmation hooks 尚未创建。这些是较小的提取（~490 行合计）。
3. **步骤 8 去重待实施**：约 400 行与 useConversation 重复的代码可通过 `conv.*` 引用替换删除。
4. **`npm run build`** 预存失败（runtime-shell 缺失）— 与重构无关。

## 建议的下一步

1. 完成步骤 9 完整死代码清理（移除旧消息列表滚动代码 + void 标记代码）
2. 完成步骤 8（与 useConversation 去重）
3. 完成步骤 4-6（剩余 3 个 hooks）
4. 端到端验证完整聊天流程

## 关联文档
- 精简方案：`32-app-deep-diet-plan.md`
- 重构状态：`31-app-modular-refactor-status.md`
- 前一更新：`078-app-modular-refactor-e2-e5-complete.md`
- 计划文件：`actichat-docs-development-status-32-app-adaptive-clover.md`
