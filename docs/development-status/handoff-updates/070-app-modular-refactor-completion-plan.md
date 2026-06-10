# 070 — App.tsx 模块化重构完成方案

**日期**：2026-06-10
**目标**：App.tsx 从当前 7,576 行减少到约 400 行（−94%）

## 当前状态

```
App.tsx 组成（7,576 行）：
─────────────────────────────────────
  1. 导入区域            290 行  (3.8%)
  2. 模块级工具/常量     1,363 行 (18.0%)  ← 可整体移出
  3. Store 选择器         212 行  (2.8%)   ← 可移入 hooks
  4. Local state + handlers 1,898 行 (25.1%)  ← 可移入 hooks
  5. Helper + handlers    1,841 行 (24.3%)  ← 可移入 hooks
  6. 内联渲染函数         1,508 行 (19.9%)  ← 可移入 views/
  7. JSX 渲染             464 行  (6.1%)   ← 可移入 AppShell
─────────────────────────────────────
```

## 阶段 A：导入清理（30 分钟）

**当前**：290 行（70 个未使用导入）
**目标**：~40 行（仅保留实际使用的导入）

**方法**：
1. 运行 `npx eslint --fix src/App.tsx` 清理可自动修复的问题
2. 手动删除剩余的未使用导入块（chat-api、chat-transcript、skills/executor、skills/protocol、skills/action-location 等）
3. 保留仅在实际代码中使用的导入

**验证**：`tsc -b --noEmit` 0 错误

## 阶段 B：模块级代码完全提取（1 小时）

**当前**：1,363 行模块级函数（组件外定义）
**目标**：0 行（全部移入 utils/）

**已提取**（3 个文件，已集成）：
- `utils/app-debug.ts` ✅
- `utils/app-images.ts` ✅
- `utils/app-formatting.ts` ✅

**待提取**（按优先级）：

| 文件 | 内容 | 估计行数 |
|------|------|----------|
| `utils/app-settings.ts` | DEFAULT_SETTINGS, loadSettings, normalizeProviderConfig, getEnabledModelOptions 等 | ~600 |
| `utils/app-conversation.ts` | createConversation, createSummaryConversation, isPersistedConversationSummary 等 | ~120 |
| `utils/app-protocol.ts` | serializeReadActionForHost, serializeRunActionForHost, serializeEditActionForHost, formatSkillStepResult, parseActionExecutionPayload 等 | ~200 |
| `utils/app-prompt.ts` | buildSkillAgentSystemPrompt, buildDeprecatedPromptBlockText, upsertDeprecatedPromptBlock 等 | ~150 |
| `utils/app-animation.ts` | MESSAGE_LIST_*常量, easeOutCubic, applyMessageListSmoothScrollAccelerationBoost 等 | ~80 |
| `utils/app-constants.ts` | ACTINET_PROVIDER_ID, ACTINET_PROVIDER_NAME, SETTINGS_STORAGE_KEY 等 | ~50 |

**方法**：参考 069 中 app-debug/app-images/app-formatting 的提取模式：
1. 用 Python 提取函数定义到新文件
2. 添加 `export` 关键字
3. 在 App.tsx 中替换为 `import`
4. 运行 `tsc -b` 验证

**阶段 B 后 App.tsx**：约 7,576 − 1,363 = 6,213 行

## 阶段 C：Store 选择器 → useAppInit hook（30 分钟）

**当前**：212 行（useSettingsStore、useChatStore、useUIStore、useExtensionsStore 的选择器）
**目标**：0 行（移至 `hooks/useAppInit.ts`）

**方法**：
- 创建 `useAppInit` hook，包含所有 store 选择逻辑
- App.tsx 调用 `const init = useAppInit()` 获取所有 store 值
- 此 hook 还应包含应用初始化逻辑（store 初始化、主题应用、daily cover 解析等）

## 阶段 D：处理函数 → 多个 hooks（2 小时）

**当前**：1,898 + 1,841 = 3,739 行
**目标**：~50 行（仅 hook 调用）

**详细拆分**：

### D1. useConversation（~500 行）
- `activeConversation`, `activeConversationResponseMode` 计算
- `conversationGroups`, `isHomepageEmptyState`, `hasActiveMessages`
- `createNewConversation`, `switchConversation`, `deleteConversation`, `confirmDeleteConversation`
- `renameConversation`（begin/cancel/save）
- `setConversationsState` 封装
- `hydrateConversationById` + useEffect
- 对话保存 useEffect（防抖）
- 图片水合 useEffect
- `buildPersistChatState` 封装

### D2. useChatUI（~400 行）
- `openDrawer/closeDrawer`（含 rAF 编排）
- `openModelMenu/closeModelMenu`
- `openSettings/closeSettings/openSettingsHome/closeSettingsPanel`
- `openImageViewer/closeImageViewer`
- `showScrollToBottomButton/hideScrollToBottomButton`
- `copyTextToClipboard/copyMessageText`
- Title editing（beginRenameConversation, cancel, save）+ TitleTransition
- Swipe 手势处理
- `openDeleteDialog`
- `cancelEdit` 恢复
- `beginEdit/saveAssistantEdit/saveUserEdit` 恢复

### D3. useSettings（~400 行）
- `handleNumericSettingChange`
- `handleProviderNumericSettingChange`
- `setProviderModelEnabled`
- `handlePermissionToggle`
- `togglePromptEditor/toggleProviderPromptEditor`
- Settings navigation
- `currentProvider` 计算
- `activeProviderRequestSettings` 计算
- Model fetching（fetchProviderModels/testProviderModel）

### D4. useExtensions（~200 行）
- `handleSkillArchiveSelect/handleRuntimeArchiveSelect`
- `handleSetSkillEnabled/handleSetRuntimeEnabled`
- `handleSetDefaultRuntime/handleTestRuntime`
- `openSkillConfigEditor/handleSkillConfigDraftChange`
- Extensions 加载 useEffect

### D5. useUpdates（~100 行）
- Update check on mount useEffect
- `handleManualUpdateCheck/handleInstallUpdate`
- `pendingUpdate/showUpdateDialog` state

### D6. usePermissions（~80 行）
- `handlePermissionToggle` + 权限请求逻辑
- `requestingPermissionByKey` 状态

### D7. useAssistant（已有 ✅，已集成）

### D8. useCloudAuth（已有 ✅，已集成）

**阶段 D 后 App.tsx**：约 6,213 − 3,739 + 50（hook 调用）= 2,524 行

## 阶段 E：渲染函数 → views/ 组件（2 小时）

**当前**：1,508 行内联渲染 + 464 行主 JSX = 1,972 行
**目标**：~200 行（精简的顶层 JSX 组装）

### E1. SettingsPage.tsx（~1,100 行）
- `renderSettingsPage` + 15 个子渲染函数
- 通过 Zustand stores 访问状态
- 接收 `resolvedDailyCover`, `cloudLoggedIn`, `cloudAuthMode`, `setCloudAuthMode` props

### E2. ChatView.tsx（~400 行）
- 对话消息列表渲染
- 消息卡片（含 `renderSkillStepEntry`）
- 流式思考指示器
- 空状态/加载/错误状态
- 对话摘要栏集成

### E3. ComposerView.tsx（~150 行）
- `renderComposerFooter`
- `renderComposerTools`
- `renderPromptEditorPanel`
- 文件输入 refs

### E4. HomepageView.tsx（~100 行）
- 主页空白态渲染
- `NewConversationShowcase` 集成
- 背景图片
- `CloudAuthForm` 条件渲染

### E5. AppShell.tsx（~200 行）
- 顶层视口布局
- Drawer/ImageViewer/DeleteConfirmation/UpdateDialog 组装
- Settings 遮罩层
- 过渡动画编排

## 阶段 F：精简 App.tsx（30 分钟）

最终 App.tsx（~400 行）：
```tsx
// 导入（~40行）
import { useAppInit } from './hooks/useAppInit'
import { useConversation } from './hooks/useConversation'
import { useChatUI } from './hooks/useChatUI'
import { useSettings } from './hooks/useSettings'
import { useExtensions } from './hooks/useExtensions'
import { useUpdates } from './hooks/useUpdates'
import { usePermissions } from './hooks/usePermissions'
import { useAssistant } from './hooks/useAssistant'
import { useCloudAuth } from './hooks/useCloudAuth'
import { AppShell } from './views/AppShell'
import { SettingsPage } from './views/SettingsPage'
import { ChatView } from './views/ChatView'
import { ComposerView } from './views/ComposerView'
import { HomepageView } from './views/HomepageView'

function App() {
  // 初始化（~10行）
  const init = useAppInit()
  const cloud = useCloudAuth({...})
  const conv = useConversation()
  const ui = useChatUI()
  const settings = useSettings()
  const ext = useExtensions()
  const updates = useUpdates()
  const perms = usePermissions()
  const assistant = useAssistant()

  // 计算属性（~20行）
  const isHomepageEmptyState = conv.isHomepageEmptyState
  const hasActiveMessages = conv.hasActiveMessages
  
  // 渲染入口（~10行）
  return (
    <AppShell
      homepage={<HomepageView {...homepageProps} />}
      chat={<ChatView {...chatProps} />}
      composer={<ComposerView {...composerProps} />}
      settings={<SettingsPage {...settingsProps} />}
      drawer={<AppDrawer {...drawerProps} />}
      modals={...}
    />
  )
}
```

## 执行顺序（依赖关系）

```
阶段 A: 导入清理           ← 无依赖
阶段 B: 模块级代码提取     ← 依赖 A
阶段 C: Store 选择器提取   ← 依赖 B
阶段 D: Handlers → hooks   ← 依赖 C（按 D1→D2→D3→D4→D5→D6 顺序）
阶段 E: 渲染函数 → views   ← 依赖 D（所有 hooks 就位后）
阶段 F: App.tsx 精简       ← 依赖 E
```

## 每个阶段的验证步骤

1. `npx tsc -b --noEmit` — TypeScript 0 错误
2. `npx vite build --configLoader native` — 构建成功
3. `npx vitest run --configLoader native` — 39 测试通过
4. `wc -l src/App.tsx` — 确认行数减少

## 关键风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| Hook 间的状态竞争 | 全部通过 Zustand stores 通信，避免 hook 间直接依赖 |
| useEffect 顺序改变 | 保持 effect 逻辑在原始位置，仅改变文件位置 |
| 渲染函数引用的局部变量 | 通过 props 或 store 访问替换 |
| 大规模重构引入 bug | 每阶段后运行完整测试套件；使用 `git bisect` 定位问题 |

## 时间估算

| 阶段 | 估计时间 | 关键难点 |
|------|---------|---------|
| A: 导入清理 | 30 分钟 | 无 |
| B: 模块级代码 | 1 小时 | 函数间交叉引用 |
| C: Store 选择器 | 30 分钟 | 无 |
| D: Handlers → hooks | 2 小时 | state/ref 解耦 |
| E: 渲染函数 | 2 小时 | props 传递策略 |
| F: 精简 | 30 分钟 | 无 |
| **合计** | **6.5 小时** | |

## 长期目标验证

最终 App.tsx 应在 **400 行以内**，仅包含：
1. 顶层 hooks 调用
2. 少量计算属性（从 hooks 返回值组合）
3. AppShell 组件的 JSX 组装

所有业务逻辑、状态管理、渲染细节均位于独立模块中。
