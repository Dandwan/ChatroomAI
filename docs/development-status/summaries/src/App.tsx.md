# `src/App.tsx`

## 功能
ActiChat 应用的主 shell 组件。包含对话管理、设置面板、主页空白态渲染、消息流处理、streaming 协议解析、云服务认证集成、首页发送过渡动画等全部核心 UI 逻辑。是应用最大、最复杂的组件。

## 关系
### 调用 / 引用
- `src/components/NewConversationShowcase.tsx` — 主页每日封面+统计数据展示
- `src/components/CloudAuthForm.tsx` — 主页云服务登录/注册表单（条件渲染）
- `src/components/CloudLoginPage.tsx` — 独立云服务登录页面（当前未使用）
- `src/components/settings/ProvidersSettings.tsx` — 服务商管理设置页
- `src/components/settings/DailyCoverSettings.tsx` — 每日封面设置页
- `src/components/settings/RuntimeSettings.tsx` — 运行时设置页
- `src/components/settings/SkillsSettings.tsx` — Skills 管理设置页
- `src/components/settings/SkillConfigSettings.tsx` — Skill 配置设置页
- `src/components/settings/PermissionsSettings.tsx` — 权限设置页
- `src/components/ChatHeader.tsx` — 对话顶部栏
- `src/components/ChatSummaryBar.tsx` — 对话摘要栏
- `src/components/ChatInputBox.tsx` — 消息输入框
- `src/components/HomepageSendTransition.tsx` — 首页发送过渡动画
- `src/components/SettingsScreen.tsx` — 设置页面壳
- `src/services/cloud-auth.ts` — `isCloudLoggedIn` 判断登录状态
- `src/services/daily-cover.ts` — 每日封面解析
- `src/services/homepage-highlights.ts` — 首页统计高亮
- `src/services/chat-storage/` — 对话持久化
- `src/services/skills/` — skill 运行时
- `src/state/ui-store.ts` — UI 状态管理（settings 导航等）

### 提供
- `App` — React 根组件（default export）

## 关键词
### 函数
- `App`
- `getResponseModeLabel`
- `buildHomepageModelTriggerLabel`

### 常量
- `HOMEPAGE_SEND_TRANSITION_DURATION_MS`
