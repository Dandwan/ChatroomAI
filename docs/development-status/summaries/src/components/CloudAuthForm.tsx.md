# `src/components/CloudAuthForm.tsx`

## 功能
嵌入主页的云服务登录/注册表单组件。替代 `NewConversationShowcase` 在主页空白态展示，提供登录和注册两种模式切换。UI 风格与主页 editorial design（风景背景 + 一句话排版）完全一致。当用户未配置服务器地址时自动显示地址输入框。

## 关系
### 调用 / 引用
- `src/services/cloud-auth.ts` — `cloudLogin`、`cloudRegister`、`getCloudServerUrl`、`CloudAuthResult`

### 提供
- `CloudAuthForm` — React 组件（default export），接受 `initialMode` 和 `onAuthSuccess` props

### 被依赖
- `src/App.tsx` — 在主页空白态条件渲染

## 关键词
### 函数
- `CloudAuthForm`
