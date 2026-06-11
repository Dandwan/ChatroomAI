# `src/App.tsx`

## 功能
ActiChat 应用的主 shell 组件。管理对话、流式协议处理、云服务认证。渲染通过 AppShell 布局壳 + 5 个 views 子组件完成。

**近期变更（2026-06-11）：Phase 2 深度精简步骤 1-3 + 7 完成**
- 3 个新 hooks 已创建：useAssistantStream, useTitleTransition, useMessageListScroll
- useChatUI 已扩展（模型菜单外部点击关闭）
- App.tsx: 7,576 → 3,191 → 2,684 行（−64.6%）
- tsc: 0 错误 ✅，测试: 39 passed ✅
- 待完成：步骤 4-6（剩余 hooks）、步骤 8（去重）、步骤 9（完整死代码清理）

## 关系
### 调用 / 引用
- `src/views/` — AppShell, SettingsPage, HomepageView, ComposerView, ChatView（全部 views 组件）
- `src/components/` — ChatHeader, ChatScrollPlaceholder, ChatSummaryBar, AppDrawer, ImageViewer, DeleteConfirmationLayer, NoticeBanner, UpdateDialog, HomepageSendTransition, TitleTransition
- `src/hooks/` — useCloudAuth, useUpdates, useConversation, useExtensions, useSettings, usePermissions, useAssistant, useChatUI, useAssistantStream, useTitleTransition, useMessageListScroll（11 个 hooks）
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
