# `src/components/CloudAuthForm.tsx`

## 功能
嵌入主页的云服务登录/注册/密码重置表单组件。替代 `NewConversationShowcase` 在主页空白态展示，提供登录、注册、忘记密码、密码重置四种模式切换。UI 风格与主页 editorial design（风景背景 + 一句话排版）完全一致。服务器地址由 `getCloudServerUrl()` 自动提供，用户无需手动输入。

**AuthMode 类型**: `'login' | 'register' | 'forgot' | 'forgotSent' | 'reset'`。登录页底部有"忘记密码？"链接按钮，点击进入 forgot 流程。密码重置流程为三步：输入邮箱（forgot）→ 邮件发送确认（forgotSent，可重新发送）→ 输入重置码和新密码（reset）。

## 关系
### 调用 / 引用
- `src/services/cloud-auth.ts` — `cloudLogin`、`cloudRegister`、`resendCloudVerification`、`requestCloudPasswordReset`、`resetCloudPassword`、`getCloudServerUrl`、`CloudAuthResult`、`CloudRegisterResult`

### 提供
- `CloudAuthForm` — React 组件（default export），接受 `initialMode` 和 `onAuthSuccess` props

### 被依赖
- `src/App.tsx` — 在主页空白态条件渲染

## 关键词
### 类型
- `AuthMode` — `'login' | 'register' | 'forgot' | 'forgotSent' | 'reset'`

### 状态
- `confirmPassword` — 重置密码时确认新密码
- `resetToken` — 密码重置码输入
- `message` — 成功/提示消息（非错误）
- `resetEmail` — 跨步骤保存的密码重置目标邮箱

### 函数
- `CloudAuthForm` — 主组件
- `handleLogin` — 登录处理
- `handleRegister` — 注册处理
- `handleForgotPassword` — 发送密码重置邮件
- `handleResetPassword` — 提交重置码和新密码
- `handleResendVerification` — 重新发送验证邮件
- `switchMode` — 切换模式，重置相关状态

### 视图
- 登录/注册视图（`mode === 'login' | 'register'`）— 含"忘记密码？"链接（仅 login 模式）
- 注册成功视图（`registerResult !== null`）— 提示验证邮箱，可重新发送验证邮件
- 忘记密码视图（`mode === 'forgot'`）— 输入邮箱请求重置邮件
- 邮件已发送视图（`mode === 'forgotSent'`）— 显示发送成功，可重新发送或输入已有重置码
- 重置密码视图（`mode === 'reset'`）— 输入重置码、新密码、确认密码