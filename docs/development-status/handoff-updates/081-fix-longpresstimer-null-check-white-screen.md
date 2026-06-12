# 081 — 修复 longPressTimerId 空值检查导致应用白屏

**日期**：2026-06-12
**类型**：Bug fix（小修复）

## 问题

ActiChat 应用开启时白屏。React 错误边界捕获：`Cannot read properties of null (reading 'longPressTimerId')`。

## 根因

`src/hooks/useConversation.ts:560`（及 378 行）使用了不正确的空值检查：

```typescript
// 错误写法 — 当 g 为 null 时，g?.longPressTimerId 返回 undefined，
// undefined !== null 为 true，进入 if 块后 g!.longPressTimerId! 崩溃
if (g?.longPressTimerId !== null) window.clearTimeout(g!.longPressTimerId!)
```

应用初始化时 `drawerMounted = false`，effect 执行：`conversationSwipeStartRef.current` 为 `null`（无手势活动），触发崩溃 → React 卸载组件树 → 白屏。

**深层原因**：Phase 2 重构（079-080）将手势交互提取到了 `useConversationDrawer.ts`，但 `useConversation.ts` 中保留了重复的旧手势代码（包括有 bug 的 effect）。App.tsx 使用 `drawer.*` 的手势函数，`useConversation.ts` 中的手势代码为死代码，但其 effect 仍在初始化时执行。

## 修复

两处空值检查修复（`src/hooks/useConversation.ts`）：

- **行 378**：`g?.longPressTimerId !== null && g` → `g && g.longPressTimerId !== null`
- **行 560**：`g?.longPressTimerId !== null` → `g && g.longPressTimerId !== null`

## 验证

- `npx tsc -b --noEmit`：0 错误 ✅
- Playwright headless：root 元素有内容，无 page error，页面正常渲染 ✅

## 决策关卡

- 符合小修复标准（单文件、根因明显、无 API 变更、2 行），跳过完整流程。

## 未解决问题

- `useConversation.ts` 中手势交互代码与 `useConversationDrawer.ts` 完全重复（死代码），需按 Phase 2 步骤 8 计划完整去重移除。
- `useConversationDrawer.ts:180` 中 `clearConversationGestureTimer()` 后未清空 `s.longPressTimerId`，可能导致定时器 ID 复用问题（低风险，不阻塞）。

## 关联文档

- 前一更新：`080-app-deep-diet-phase2-complete.md`
- 重构状态：`31-app-modular-refactor-status.md`
- 精简方案：`32-app-deep-diet-plan.md`（步骤 8：与 useConversation 去重）
