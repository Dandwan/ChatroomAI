# `cloud-server/admin-ui/src/pages/LoginPage.tsx`

## 功能
Admin UI 登录页面。管理员用户名 + 密码登录表单，调用 `useAuth().login()` 进行认证。标题显示为 ActiNet 管理后台。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/auth-context.js` — `useAuth`

### 提供
- `LoginPage` — React 组件

### 被依赖
- `cloud-server/admin-ui/src/App.tsx` — 未认证时渲染登录页

## 关键词
### 函数
- `LoginPage` — 主组件
- `handleSubmit` — 表单提交处理
