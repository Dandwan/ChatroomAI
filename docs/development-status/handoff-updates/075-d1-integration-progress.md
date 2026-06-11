# 075 — D1 集成进度与当前状态

**日期**：2026-06-11

## 范围

将 useConversation hook 从命名空间模式切换到完全解构集成，移除 App.tsx 中重复的内联 conversation effects。

## 当前状态总览

| 阶段 | 状态 | App.tsx 行数 | 变化 |
|------|------|-------------|------|
| 初始（074 基线） | — | 5,416 | — |
| **D1 集成** | 🔧 进行中 | **5,083** | **−333** |
| 修复 8 个预存 tsc 错误 | ❌ 未开始 | — | — |
| E views 提取 | ❌ 未开始 | — | ~1,500 |
| F 最终精简 | ❌ 未开始 | — | ~200 |
| 端到端验证 | ❌ 未开始 | — | — |

## D1 集成已完成的工作

### 从 App.tsx 移除的重复代码

| # | 移除内容 | 位置（原始行号） | 行数（估计） |
|---|---------|----------------|------------|
| 1 | `hydrateConversationById` useCallback | 2408-2492 | ~85 |
| 2 | chat index 加载 useEffect | 2358-2406 | ~50 |
| 3 | 图片 data URL 水合 useEffect | 2495-2610 | ~120 |
| 4 | 对话持久化防抖 useEffect | 2612-2664 | ~55 |
| 5 | `chatStateSignatureRef` | 403 | 1 |
| 6 | `conversationPersistTaskIdRef` | 402 | 1 |
| 7 | `hydratingImageKeysRef` | 406 | 1 |
| 8 | `setHistoryStats` selector | 282 | 1 |
| 10 | `setChatStateLoaded` selector | 286 | 1 |
| 11 | `setSettings` selector | 268 | 1 |
| 12 | `setNumericSettingDrafts` selector | 270 | 1 |
| | **合计移除** | | **~318** |

### App.tsx 引用更新

- `hydrateConversationById(...)` → `conv.hydrateConversationById(...)`（2 处：switchConversation 内 + JSX 重试按钮）
- `setSkillConfigTargetId/Draft/Value/RawError(...)` → `useExtensionsStore.getState().setSkillConfig*(...)`（3 处）

### Hook 修复

- **useConversation.ts**: 将 `hydrateConversationByIdImpl` 添加到返回对象中
- **useSettings.ts**: 添加了缺失的 `resetProviderDetailState` 实现
- **useSettings.ts**: 添加了缺失的 `setIsFetchingModelsByProviderId` store selector

### App.tsx bug 修复

- **usePermissions hook 从未被调用**: 添加了 `const perms = usePermissions(pushNotice)` 调用——之前在 074 中标记为"已集成"但实际 hook 调用被遗漏

## 剩余编译错误（2 个）

两个错误都在 `src/hooks/useChatUI.ts`，导入清理时 `import {` 行被意外删除。

**已在 076 修复** ✅

## 构建状态

- `npx tsc -b --noEmit`：2 错误（已在 076 修复）
- `npm run build`：失败（预存问题：builtin-skills/runtime-shell/ 目录缺失）
- `wc -l src/App.tsx`：5,083（从 5,416 −333 行）

## 关联文档

- 重构方案：`070-app-modular-refactor-completion-plan.md`
- 进度总览：`072-app-modular-refactor-progress.md`
- 集成进度：`074-app-modular-refactor-integration-progress.md`
- 完成报告：`076-d1-integration-complete-and-error-fixes.md`
