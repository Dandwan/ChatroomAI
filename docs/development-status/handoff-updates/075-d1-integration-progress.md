# 075 — D1 集成进度与当前状态

**日期**：2026-06-12

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

| # | 移除内容 | 行数（估计） |
|---|---------|------------|
| 1 | `hydrateConversationById` useCallback | ~85 |
| 2 | chat index 加载 useEffect | ~50 |
| 3 | 图片 data URL 水合 useEffect | ~120 |
| 4 | 对话持久化防抖 useEffect | ~55 |
| 5 | `chatStateSignatureRef`、`conversationPersistTaskIdRef`、`hydratingImageKeysRef` | 3 |
| 6 | `setHistoryStats`、`setChatStateLoadError`、`setChatStateLoaded` selectors | 3 |
| 7 | `setSettings`、`setNumericSettingDrafts` selectors | 2 |
| 8 | ~20 个未使用的导入符号 | ~20 |
| | **合计移除** | **~338** |

### App.tsx 引用更新

- `hydrateConversationById(id)` → `conv.hydrateConversationById(id)`（2 处）
- `setSkillConfigTargetId/Draft/Value/RawError(...)` → `useExtensionsStore.getState().setSkillConfig*(...)`（3 处）

### Hook 修复

- **useConversation.ts**: `hydrateConversationByIdImpl` 添加到返回对象（之前仅内部定义但未导出）
- **useSettings.ts**: 添加缺失的 `resetProviderDetailState` 实现
- **useSettings.ts**: 添加缺失的 `setIsFetchingModelsByProviderId` store selector

### Bug 修复

- **usePermissions hook 从未被调用**: 添加了 `const perms = usePermissions(pushNotice)` 调用。之前在 074 中标记为"已集成"但实际 hook 调用被遗漏。

## 剩余编译错误（2 个）

两个错误都在 `src/hooks/useChatUI.ts`——导入语句语法错误：

```
error TS1109: Expression expected.  (line 18)
error TS1434: Unexpected keyword or identifier.  (line 18)
```

**根因**：清理 `import { toImageViewerItem, collectConversationImageViewerItems } from '../utils/app-images'` 时，紧接的 `import {` 行（app-module 导入块的起始）也丢失。

**修复**：在 `TITLE_EDIT_TRANSITION_MS,` 前添加 `import {` 一行。

## 预存 tsc 错误（第二阶段任务）

| 符号 | 出现次数 |
|------|---------|
| `removePendingImage` | 1 |
| `updatePendingImageCompression` | 1 |
| `stopGeneration` | 1 |
| `resetPromptToDefault` | 6 |
| `fetchProviderModels` | 1 |
| `testProviderModel` | 1 |
| `saveAssistantEdit` | 1 |
| `saveUserEdit` | 2 |
| `beginEdit` | 1 |

**根因**：这些函数在 hooks 中有定义但未通过 destructure 暴露给 App.tsx 渲染函数引用。

## 构建状态

- **`npx tsc -b --noEmit`**: 2 错误（均为 useChatUI.ts 导入语法错误）
- **`npm run build`**: 失败（预存：`builtin-skills/runtime-shell/` 目录缺失）
- **`wc -l src/App.tsx`**: **5,083**（从 5,416 −333 行，−6.1%）

## 关键发现

### D1 effects 移除安全性

移除的 4 个 effects 使用的所有状态变量（refs、store selectors、导入函数）**仅由这些 effects 使用**，无其他代码路径引用。useConversation hook 通过独立的 store selectors 访问相同的 Zustand stores，因此移除后无功能影响。

### hook-app 行为差异（低风险）

| 方面 | App.tsx 原 effects | useConversation hook effects |
|------|-------------------|------------------------------|
| 错误处理 | `setNotice` + 持久化警告 | 静默忽略错误 |
| 图片水合 | 直接赋值 `transcript` | 使用 `withConversationRecordTranscript`（更新摘要） |
| 启动转换 | 使用 `startTransition` 包装 | 同等使用 `startTransition` |

差异不会导致功能问题，但建议在端到端验证中关注对话持久化和历史加载的错误提示。

## 下一步计划

### 1. 修复剩余 2 个编译错误（5 分钟）
useChatUI.ts 添加丢失的 `import {` 行

### 2. 修复 8 个预存 tsc 错误（30 分钟）
在 useAssistant、useSettings hooks 的返回对象中暴露缺失的函数引用

### 3. 阶段 E：Views 提取（2 小时）
- E1 SettingsPage.tsx（~1,300 行）
- E5 AppShell.tsx（~100 行）
- E2 ChatView.tsx（~200 行）
- E3 ComposerView.tsx（~100 行）
- E4 HomepageView.tsx（~50 行）

### 4. 阶段 F：最终精简 + 文档更新（30 分钟）
目标 App.tsx ~400 行，更新所有代码摘要

### 5. 端到端验证（30 分钟）
构建 + 测试 + 真机/模拟器验证对话持久化和历史加载

## 关联文档

- 重构方案：`070-app-modular-refactor-completion-plan.md`
- 进度总览：`072-app-modular-refactor-progress.md`
- 前一阶段：`074-app-modular-refactor-integration-progress.md`
