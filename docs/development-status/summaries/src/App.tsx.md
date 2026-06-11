# `src/App.tsx`

## 功能
ActiChat 应用的主 shell 组件。包含对话管理、流式协议处理、云服务认证、消息渲染、主页发送过渡动画等核心 UI 逻辑。

**近期变更（2026-06-11）：模块化重构阶段 E1**
- 16 个设置渲染函数（~1,300 行）提取到 `src/views/SettingsPage.tsx`
- 文件大小：5,099 → 3,764 行（−1,335 行，−26.2%）
- tsc: 0 错误 ✅，测试: 39 passed ✅

## 关系
### 调用 / 引用
- `src/views/SettingsPage.tsx` — 设置页面组件（E1 提取）
- `src/components/` — ChatHeader, ChatInputBox, ChatSummaryBar, AppDrawer, ImageViewer 等
- `src/hooks/` — useCloudAuth, useUpdates, useConversation, useExtensions, useSettings, usePermissions, useAssistant, useChatUI
- `src/services/` — chat-api, chat-transcript, cloud-auth, daily-cover, actinet-models 等
- `src/state/` — ui-store, chat-store, settings-store, extensions-store
- `src/utils/` — app-module, app-images, app-debug, app-formatting, assistant-flow, model-utils, text-utils, time-utils

### 提供
- `App` — React 根组件（default export）

### 被依赖
- `src/main.tsx` — 入口文件渲染 App 组件

## 关键词
### 函数
- `App` — 应用主组件
- `renderComposerTools`, `renderComposerFooter` — 输入框渲染（待 E3 提取）
- `handleSend`, `handleAppend`, `regenerate`, `pushNotice` — 核心交互处理

### 待提取（E2-E5）
- `renderSkillStepEntry` + 消息列表渲染 → ChatView.tsx (~200 行)
- `renderComposerTools` + `renderComposerFooter` → ComposerView.tsx (~300 行)
- 主页空白态渲染 → HomepageView.tsx (~50 行)
- 顶层 JSX 布局 → AppShell.tsx (~500 行)
