# 084 — 修复蓝屏崩溃：空值检查导致初始化时 crash

**日期**：2026-06-12
**类型**：Bug fix（小修复）

## 问题

ActiChat 打开蓝屏。React 错误边界捕获 `TypeError: Cannot read properties of null`。

## 根因

未提交的 `useConversation.ts` 变更重新添加了 147 行手势交互 + 标题编辑代码（这些代码在 #082 中已被有意删除，因其与 `useConversationDrawer.ts` / `useTitleTransition.ts` 完全重复）。

重新添加的 `useEffect`（第 560 行，当前工作树）包含 #081 白屏崩溃的完全相同模式：

```typescript
useEffect(() => {
    if (drawerMounted) return
    const g = conversationSwipeStartRef.current  // 初始化时为 null
    if (g?.longPressTimerId !== null)             // undefined !== null → true
      window.clearTimeout(g!.longPressTimerId!)   // 💥 g 为 null，崩溃
}, ...)
```

当 `drawerMounted = false`（初始状态）且 `conversationSwipeStartRef.current` 为 `null` 时：
- `g?.longPressTimerId` → `undefined`
- `undefined !== null` → `true`
- `g!.longPressTimerId!` → TypeError（`null.longPressTimerId`）

→ React 错误边界捕获 → 卸载组件树 → 蓝屏。

## 修复

两处空值检查修正（`src/hooks/useConversation.ts`）：

| 位置 | 修复前 | 修复后 |
|------|--------|--------|
| `clearConversationGestureTimer`（行 378） | `g?.longPressTimerId !== null && g` | `g && g.longPressTimerId !== null` |
| 初始化 effect（行 560） | `g?.longPressTimerId !== null` | `g && g.longPressTimerId !== null` |

两处均改为正确的短路模式：先检查 `g` 非 null，再访问 `g.longPressTimerId`。

## 验证

```bash
npx tsc -b --noEmit    # 0 错误 ✅
npx vitest run          # 39 passed ✅
npm run build           # ✓ built in 338ms ✅
```

## 决策关卡

- 符合小修复标准（单文件、根因明显、无 API 变更、2 行），跳过完整流程。

## 注意

- 重新添加的手势/标题编辑代码（147 行）与 `useConversationDrawer.ts` / `useTitleTransition.ts` 完全重复。App.tsx 尚未使用这些重新添加的导出，但如果该功能是有意为之，应考虑让 `useConversation.ts` 直接复用 `useConversationDrawer.ts` 中的手势逻辑，而非复制代码。
- 未提交变更还包括 ActiNet 高级模型开关功能（`ActiNetSettings.tsx`、`actinet-models.ts`、`types.ts`），与本次崩溃无关。

## 关联文档

- 前一更新：`083-audit-bug-fixes-and-dead-code-cleanup.md`
- #081 白屏修复（相同 bug 模式）：`081-fix-longpresstimer-null-check-white-screen.md`
- #082 重复代码移除：`082-refactor-residue-cleanup.md`
- 当前状态：`30-current-state-and-known-issues.md`
