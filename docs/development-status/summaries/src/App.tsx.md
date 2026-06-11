# `src/App.tsx`

## 功能
ActiChat 应用的主 shell 组件。管理对话、流式协议处理、云服务认证。渲染通过 AppShell 布局壳 + 5 个 views 子组件完成。

**近期变更（2026-06-11）：模块化重构 E2-E5 + F 完成**
- 全部 5 个 views 组件已提取：SettingsPage, HomepageView, ComposerView, ChatView, AppShell
- App.tsx: 7,576 → 3,191 行（−57.9%）
- tsc: 0 错误 ✅，测试: 39 passed ✅

## 关系
### 调用 / 引用
- `src/views/` — AppShell, SettingsPage, HomepageView, ComposerView, ChatView（全部 views 组件）
- `src/components/` — ChatHeader, ChatScrollPlaceholder, ChatSummaryBar, AppDrawer, ImageViewer, DeleteConfirmationLayer, NoticeBanner, UpdateDialog, HomepageSendTransition, TitleTransition
- `src/hooks/` — useCloudAuth, useUpdates, useConversation, useExtensions, useSettings, usePermissions, useAssistant, useChatUI（全部 8 个 hooks）
- `src/services/` — chat-storage, chat-transcript, cloud-auth, daily-cover, actinet-models, homepage-highlights
- `src/state/` — ui-store, chat-store, settings-store, extensions-store
- `src/utils/` — app-module, app-debug, app-formatting, assistant-flow, text-utils, time-utils, model-utils

### 提供
- `App` — React 根组件（default export）

### 被依赖
- `src/main.tsx` — 入口文件渲染 App 组件

## 关键词
### 函数
- `App` — 应用主组件，调用 8 个 hooks + 组装 AppShell JSX
- `pushNotice` — 通知推送
- `handleSend`, `handleAppend`, `regenerate` — 核心交互委托给 useAssistant
