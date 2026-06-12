# 086 — 恢复 App.tsx 重构：修正 #083 意外回退

**日期**：2026-06-12
**类型**：Bug 修复（恢复性）
**来源**：用户发现 App.tsx 5,097 行，但根据 082 交接文档应为 1,115 行

## 问题

Commit `0a84ec9`（#083 审计 bug 修复）在修复 2 个 P0 bug 时，意外将 App.tsx 从 1,115 行膨胀回 5,097 行（+4,601 插入，−619 删除），实际上回退了 #069-#082 的大部分重构工作。同时 `useConversation.ts` 也被意外恢复了 147 行已在 #082 中删除的重复代码。

## 根因

`0a84ec9` 提交的 `src/App.tsx` 变更量异常大（+4,601/−619），而预期仅需 −2 行（移除 `copyTextToClipboard` 解构）。判断为开发者在修复 bug 时基于了重构前的分支版本，提交时将旧版代码一起带入。

## 变更的代码区域

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.tsx` | 恢复 + 重新应用 | `git checkout 5c2bf00` 恢复到 1,115 行；重新应用 #085 的 ActiNet 模型可见性修复（3 处修改） |
| `src/hooks/useConversation.ts` | 恢复 | `git checkout 5c2bf00` 恢复到 #082 清理后的干净版本（569 行），移除 #083 意外恢复的 147 行重复手势/标题编辑代码 |

### 未修改的文件（保留 #083/#085 的正确修复）

| 文件 | 说明 |
|------|------|
| `src/hooks/useAssistant.ts` | Bug #1 fix（AbortController）+ #085 去重（−31 行）|
| `src/hooks/useSettings.ts` | Bug #7 fix（ActiNet 模型选择）+ Bug #8 fix（modelHealth 清理）|
| `src/state/chat-store.ts` | Issue #5：移除死字段 chatSummarySnapshot |
| `src/state/ui-store.ts` | Issue #5：移除死字段 chatSummarySnapshot |
| `src/services/actinet-models.ts` | CORE_ACTINET_MODEL_IDS + getEffectiveActiNetModels 重构 |
| `src/state/types.ts` | 新增 actiNetAdvancedModelsEnabled |
| `src/utils/app-module.ts` | #085：getEnabledModelOptions 使用 getVisibleActiNetModels |
| `src/components/settings/ActiNetSettings.tsx` | #085：UI 重构，高级模型开关 |
| `src/views/SettingsPage.tsx` | #085：追加 actiNetAdvancedModelsEnabled 参数 |
| `src/hooks/useAssistantStream.ts` | 已删除（Issue #3 死文件）|

### 修改的摘要文件

| 文件 | 操作 |
|------|------|
| `docs/development-status/summaries/src/App.tsx.md` | 更新（#085 修复恢复记录）|
| `docs/development-status/summaries/src/hooks/useConversation.ts.md` | 更新（恢复记录）|

## App.tsx #085 改动（重新应用）

在干净的 1,115 行 App.tsx 上应用 3 处修改：

1. **导入**：`import { getVisibleActiNetModels } from './services/actinet-models'`（仅导入 `getVisibleActiNetModels`，因 `getEffectiveActiNetModels` 不再在 App.tsx 中使用）
2. **`enabledModelOptions` memo**：追加第四参数 `settings.actiNetAdvancedModelsEnabled` 及对应依赖项
3. **`enabledModelsByProvider` memo**：改用 `getVisibleActiNetModels(settings.actiNetAdvancedModelsEnabled)` 替代 `getEffectiveActiNetModels().filter(m => m.enabled)`；依赖数组追加 `settings.actiNetAdvancedModelsEnabled`

## 验证

```bash
npx tsc -b --noEmit   # 0 错误 ✅
npx vitest run         # 39 passed ✅（1 e2e 预存失败，与本次无关）
```

| 维度 | 修复前 | 修复后 |
|------|--------|--------|
| **App.tsx** | 5,097 行 ❌ | **1,115 行** ✅ |
| **useConversation.ts** | 716 行（含重复代码）| **569 行** ✅（干净）|
| **tsc** | 0 错误 | 0 错误 ✅ |
| **vitest** | 39 passed | 39 passed ✅ |

## 决策关卡

- 方案已确认：是

## 未解决问题

- P4 Issue #6：跨模块重复函数统一（`useConversation.ts` ↔ `useAssistant.ts`，4 个函数）— 已知技术债务
- `npm run build` 可能仍失败（预存问题，与本次无关）

## 关联文档

- #082 残留清理：`082-refactor-residue-cleanup.md`
- #083 审计修复（正确的部分保留）：`083-audit-bug-fixes-and-dead-code-cleanup.md`
- #084 白屏修复（不再需要 — 修复的是不该存在的代码）：`084-fix-blue-screen-null-check-crash.md`
- #085 ActiNet 模型可见性（重新应用到干净版本）：`085-fix-actinet-core-model-visibility.md`
- 重构状态：`31-app-modular-refactor-status.md`
- 当前状态：`30-current-state-and-known-issues.md`
