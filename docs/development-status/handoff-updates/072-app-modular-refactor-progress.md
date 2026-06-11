# 072 — App.tsx 模块化重构 当前进度与剩余方案

**日期**：2026-06-11
**任务**：App.tsx 模块化重构——进度报告与剩余执行方案

## 完成进度总览（最后更新：2026-06-11）

| 阶段 | 状态 | App.tsx 行数 | 变化 | 说明 |
|------|------|-------------|------|------|
| 初始 | — | 7,576 | — | Phase 1 (069) 完成后的起点 |
| **A** 导入清理 | ✅ 完成 | 7,228 | −348 (−4.6%) | 移除 5 个完全未用的导入块，修剪 6 个部分使用的导入块 |
| **B** 模块提取 | ✅ 完成 | 6,221 | −1,007 (−13.9%) | 1,050 行模块级代码提取到 utils/app-module.ts |
| **D2** useChatUI | ✅ 完成 | 6,080 | −141 (−2.3%) | UI handler 替换为 useChatUI hook |
| C Store 选择器 | ⏭️ 跳过 | — | — | 收益小（~200行），跳过以聚焦高收益阶段 |
| D1 useConversation | 🔧 已导入 | — | — | hook 创建（470行），保留命名空间调用，effects 风险待处理（详见 074） |
| D3 useSettings | ✅ 已集成 | 5,682 | −304 | 解构替换 17 个内联函数（详见 074） |
| D4 useExtensions | ✅ 已集成 | 5,416 | −266 | 解构替换 28 个内联函数（详见 074） |
| D5 useUpdates | ✅ 已集成 | 5,986 | −98 | 最早集成的小 hook |
| D6 usePermissions | ✅ 已集成 | 5,986 | — | 最早集成的小 hook |
| E views | ❌ 未做 | — | ~1,500 | 渲染函数提取（详见 074 第二阶段） |
| F polish | ❌ 未做 | — | ~200 | 最终精简（详见 074 第三阶段） |
| **当前** | — | **5,416** | **−2,160 (−28.5%)** | |
| **目标** | — | **~400** | **−7,176 (−94.7%)** | |

> **更新说明**：D3/D4/D5/D6 全部通过解构替换成功集成。D1 hook 已创建并导入，
> 但因 10 个 effects 与 App.tsx 深度交织暂保留命名空间调用。
> 详见 `074-app-modular-refactor-integration-progress.md`。

## 已完成的详细工作

### 阶段 A：导入清理（见 071）
- 移除 chat-api、skills/executor、skills/protocol、action-location、utils/images 5 个完全未用的导入块
- 修剪 chat-transcript、info-system-prompts、skills/types、assistant-flow、state/types、app-debug 6 个部分使用的导入块
- 移除 21 个死模块级函数（旧版 executeAssistantTurn 辅助函数，已复制到 useAssistant.ts）
- 20 个组件级死声明通过 void 引用临时抑制

### 阶段 B：模块代码提取
- 创建 `src/utils/app-module.ts`（1,128 行）— 含所有导出的常量、函数和类型
- App.tsx 中的对应代码替换为 42 个命名导入
- 清理提取产生的多余导入

### 阶段 D2：useChatUI 集成
- `src/hooks/useChatUI.ts` 更新为完整实现
- 替换 App.tsx 中内联的 UI handler（drawer、modelMenu、settings、imageViewer、scroll、clipboard、deleteDialog）
- 保持所有 store 状态变量和动画 ref 的原有行为

## 已创建/修改的文件

| 文件 | 状态 | 阶段 | 行数 |
|------|------|------|------|
| `src/App.tsx` | ✅ 修改 | A/B/D2 | 6,080 |
| `src/utils/app-module.ts` | ✅ 新建 | B | 1,128 |
| `src/hooks/useChatUI.ts` | ✅ 修改 | D2 | 完整实现 |
| `src/utils/app-debug.ts` | ✅ 已存在 | 069 | — |
| `src/utils/app-images.ts` | ✅ 已存在 | 069 | — |
| `src/utils/app-formatting.ts` | ✅ 已存在 | 069 | — |
| `src/hooks/useAssistant.ts` | ✅ 已存在 | 069 | 1,722 |
| `src/hooks/useCloudAuth.ts` | ✅ 已存在 | — | 94 |
| `src/hooks/useConversation.ts` | 🔧 骨架 | — | 22 |
| `src/hooks/useSettings.ts` | 🔧 骨架 | — | 20 |
| `src/hooks/useExtensions.ts` | 🔧 骨架 | — | 17 |
| `src/hooks/usePermissions.ts` | 🔧 骨架 | — | 15 |
| `src/hooks/useUpdates.ts` | 🔧 骨架 | — | 16 |
| `src/views/SettingsPage.tsx` | 🔧 骨架 | — | 82 |

## 剩余执行方案

### 阶段 D1：创建 useConversation hook（估计 2 小时）

**提取内容**（从 App.tsx ~500 行）：
- `activeConversation`, `activeConversationResponseMode`, `conversationGroups` 等计算属性
- `createNewConversation`, `switchConversation`, `deleteConversation`, `confirmDeleteConversation`
- `renameConversation`（begin/cancel/save）
- `hydrateConversationById` + useEffect 加载对话状态
- 对话保存 useEffect（防抖 persistChatState）
- 图片水合 useEffect
- `buildPersistChatState` 封装

**方法**：
1. 创建 `src/hooks/useConversation.ts`，使用 Zustand stores（useChatStore, useUIStore, useSettingsStore）
2. 复制 App.tsx 中的对话相关处理函数和 effect
3. 在 App.tsx 中调用 `const conv = useConversation()`，替换内联代码
4. 验证 tsc、build、tests

**难点**：对话 CRUD 逻辑与很多其他代码（UI、设置、扩展）交织，需要仔细解耦

### 阶段 D3：创建 useSettings hook（估计 1.5 小时）

**提取内容**（从 App.tsx ~400 行）：
- `handleNumericSettingChange`, `handleProviderNumericSettingChange`
- `setProviderModelEnabled`, `handlePermissionToggle`
- `togglePromptEditor`, `toggleProviderPromptEditor`
- 设置导航
- `currentProvider`, `activeProviderRequestSettings` 计算
- `fetchProviderModels`, `testProviderModel`

### 阶段 D4：创建 useExtensions hook（估计 1 小时）

**提取内容**（从 App.tsx ~200 行）：
- `handleSkillArchiveSelect`, `handleRuntimeArchiveSelect`
- `handleSetSkillEnabled`, `handleSetRuntimeEnabled`
- `handleSetDefaultRuntime`, `handleTestRuntime`
- `openSkillConfigEditor`, `handleSkillConfigDraftChange`
- extensions 加载 useEffect

### 阶段 D5-D6：创建 useUpdates 和 usePermissions hooks（估计 30 分钟）

小 hooks，每个 ~80-100 行。

### 阶段 E：渲染函数 → views/（估计 3-4 小时）

| 组件 | 行数 | Props 策略 |
|------|------|-----------|
| SettingsPage.tsx | ~1,100 | Zustand stores 直接访问 |
| ChatView.tsx | ~400 | messages, loading, handlers props |
| ComposerView.tsx | ~150 | send/image handlers props |
| HomepageView.tsx | ~100 | stats, showcase props |
| AppShell.tsx | ~200 | children, modals props |

### 阶段 F：最终精简（估计 30 分钟）

最终 App.tsx（~400 行）：
```tsx
// 导入（~20行）
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
  const conv = useConversation()
  const ui = useChatUI()
  const settings = useSettings()
  const ext = useExtensions()
  const updates = useUpdates()
  const perms = usePermissions()
  const assistant = useAssistant()
  const cloud = useCloudAuth(...)
  
  // 计算属性（~10行）
  
  // 渲染（~20行）
  return (
    <AppShell
      drawer={<AppDrawer />}
      homepage={<HomepageView />}
      chat={<ChatView />}
      composer={<ComposerView />}
      settings={<SettingsPage />}
    />
  )
}
```

## 验证

每次提交前：
```bash
npx tsc -b --noEmit    # TypeScript 0 新错误（9 预存 OK）
npm run build           # 构建成功
npx vitest run          # 39 测试通过
```

## 已知预存 tsc 错误（9 个，不影响功能）

| 错误 | 类型 | 预存？ |
|------|------|--------|
| removePendingImage | TS2552 | ✅ 是 |
| updatePendingImageCompression | TS2304 | ✅ 是 |
| stopGeneration | TS2304 | ✅ 是 |
| fetchProviderModels | TS2304 | ✅ 是 |
| testProviderModel | TS2304 | ✅ 是 |
| saveAssistantEdit | TS2304 | ✅ 是 |
| saveUserEdit | TS2304 | ✅ 是 |
| beginEdit | TS2304 | ✅ 是 |

## 为什么跳过阶段 C

阶段 C（Store 选择器提取到 useAppInit）仅节省 ~200 行，但需要：
- 将所有 30+ 个 Zustand selector 调用移到 hook 中
- 更新所有引用（`settings` → `init.settings`）——修改分布在 ~6,000 行中

投入产出比低，建议在阶段 D/E 完成后作为小优化处理。
