# `src/components/CloudLoginPage.tsx`

## 功能
云服务登录页面组件。用于从设置页单独打开的登录界面（非主页嵌入）。提供用户名/邮箱 + 密码的登录表单，成功后触发 `onLoginSuccess` 回调。

## 关系
### 调用 / 引用
- `src/services/cloud-auth.ts` — `cloudLogin`、`CloudAuthResult`

### 提供
- `CloudLoginPage` — React 组件，接受 `serverUrl`、`onLoginSuccess`、`onCancel` props

### 被依赖
- `src/components/settings/ActiNetSettings.tsx` — 设置页中的 ActiNet 登录入口

## 关键词
### 函数
- `CloudLoginPage` — 主组件
- `handleSubmit` — 表单提交处理

### Props
- `serverUrl` — 云服务器地址
- `onLoginSuccess` — 登录成功回调
- `onCancel` — 取消回调
