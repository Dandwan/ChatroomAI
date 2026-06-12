# 083 — 重构审计 Bug 修复与死代码清理

**日期**：2026-06-12
**类型**：Bug 修复 + 死代码清理
**来源**：`audit-refactor-comparison-2026-06-12.md` 审计报告

## 范围

基于重构前后完整对比审计报告，修复 2 个 P0 严重功能 Bug、1 个 P1 数据完整性问题、1 处死文件删除、2 处死代码清理。

## 变更的代码区域

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/hooks/useAssistant.ts` | 修改 +2 | Bug #1：processQueuedTurnExecutions 存储 AbortController 到 store；stopGeneration 调用 abort() |
| `src/hooks/useSettings.ts` | 修改 +12 | Bug #7：selectCurrentModel 使用 ACTINET_PROVIDER_ID + getEffectiveActiNetModels()；Bug #8：deleteProvider 清理 modelHealth |
| `src/state/chat-store.ts` | 修改 −5 | Issue #5：移除死字段 chatSummarySnapshot / setChatSummarySnapshot |
| `src/state/ui-store.ts` | 修改 −5 | Issue #5：移除死字段 chatSummarySnapshot / setChatSummarySnapshot |
| `src/hooks/useAssistantStream.ts` | 删除 −422 | Issue #3：零引用死文件 |
| `src/App.tsx` | 修改 −2 | 预存问题：移除 copyTextToClipboard 解构（useChatUI 已删此函数） |

### 修改的摘要文件

| 文件 |
|------|
| `docs/development-status/summaries/src/hooks/useAssistant.ts.md` |
| `docs/development-status/summaries/src/hooks/useSettings.ts.md` |
| `docs/development-status/summaries/src/App.tsx.md` |
| `docs/development-status/summaries/src/state/chat-store.ts.md`（新建） |
| `docs/development-status/summaries/src/state/ui-store.ts.md`（新建） |
| `docs/development-status/summaries/src/hooks/useAssistantStream.ts.md`（记录已删除状态） |

## 修复的具体问题

### Bug #1: stopGeneration 无法中止请求（P0）
- **根因**：重构后 `processQueuedTurnExecutions` 中的 `AbortController` 是局部变量从不存储，`stopGeneration` 无法获取引用
- **修复**：添加 `useChatStore.getState().setAbortController(controller)` 存储 controller；`stopGeneration` 中调用 `useChatStore.getState().abortController?.abort()`
- **验证方式**：tsc 0 错误，代码路径直接交叉对比确认

### Bug #7: ActiNet 模型选择静默失败（P0）
- **根因**：`selectCurrentModel` 中硬编码 `'actinet'` ≠ `ACTINET_PROVIDER_ID`（`'__actinet__'`），且使用 raw `actiNetModels` 未过滤 `enabled`
- **修复**：导入 `ACTINET_PROVIDER_ID` + `getEffectiveActiNetModels()`，恢复旧代码正确的 `m.enabled` 检查
- **验证方式**：tsc 0 错误，代码路径对比确认与重构前等价

### Bug #8: deleteProvider 缺少 modelHealth 清理（P1）
- **根因**：重构后的 `deleteProvider` 移除了旧代码中的 `setModelHealth` 清理逻辑
- **修复**：添加 `useExtensionsStore.getState().setModelHealth(...)` 调用，按 `providerId::` 前缀过滤删除
- **验证方式**：tsc 0 错误，逻辑对比确认

### Issue #2: App.tsx 孤儿表达式（P2）
- **状态**：已在 082 清理中移除，无需处理

### Issue #3: useAssistantStream.ts 死文件（P3）
- **操作**：删除文件（422 行），全 src 目录零 import
- **风险**：流 delta RAF 清理 effect 的唯一保留位置删除，但该文件从未被实际导入使用，无功能影响

### Issue #5: chatSummarySnapshot 死字段（P3）
- **操作**：从 chat-store.ts 和 ui-store.ts 移除 `chatSummarySnapshot` + `setChatSummarySnapshot`（两处定义均零外部调用）
- **实际使用**：`useConversation.ts:194` 局部计算
- `abortController` 字段保留（Bug #1 修复后已激活使用）

### Issue #6: 跨模块重复函数（P4）
- **状态**：已知技术债务，不在本次修复范围

## 验证

```bash
npx tsc -b --noEmit   # 0 错误 ✅
npx vitest run         # 39 passed ✅（1 E2E 预存失败，与本次无关）
```

## 决策关卡

- 方案已确认：是（用户明确确认）

## 当前状态

| 维度 | 数值 |
|------|------|
| **App.tsx** | 1,113 行 |
| **Hooks 总数** | 13（useAssistantStream.ts 已删除） |
| **tsc** | 0 错误 ✅ |
| **vitest** | 39 passed ✅ |

## 未解决问题

1. `npm run build` 失败（`builtin-skills/runtime-shell/` 缺失）— 预存问题，与重构无关
2. P4 Issue #6：跨模块重复函数统一（`useConversation.ts` ↔ `useAssistant.ts`，4 个函数，约 100 行重构）

## 关联文档

- 前一更新：`082-refactor-residue-cleanup.md`
- 审计报告：`audit-refactor-comparison-2026-06-12.md`
- 重构状态：`31-app-modular-refactor-status.md`
- 当前状态：`30-current-state-and-known-issues.md`
