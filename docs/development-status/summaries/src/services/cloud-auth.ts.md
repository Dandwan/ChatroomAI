# `src/services/cloud-auth.ts`

## 功能
提供 ActiChat 云服务（ActiNet）前端的认证服务层。包含用户登录、注册、本地认证状态持久化、会话管理等功能。所有认证令牌和用户信息持久化到 `localStorage`。

## 关系
### 调用 / 引用
- `src/components/CloudAuthForm.tsx` — 使用 `cloudLogin`、`cloudRegister`、`getCloudServerUrl`
- `src/components/CloudLoginPage.tsx` — 使用 `cloudLogin`
- `src/App.tsx` — 使用 `isCloudLoggedIn` 判断登录状态

### 提供
- `CloudAuthResult` — 认证响应接口（token、api_key、user）
- `StoredCloudAuth` — 本地存储的认证状态接口
- `getStoredCloudAuth()` — 从 localStorage 读取已保存的认证信息
- `getCloudServerUrl()` — 获取已保存的服务器地址
- `setCloudServerUrl(url)` — 持久化服务器地址
- `saveCloudAuth(auth)` — 持久化认证信息
- `clearCloudAuth()` — 清除认证信息
- `isCloudLoggedIn()` — 判断是否已登录（有 apiKey）
- `cloudLogin(serverUrl, username, password)` — POST /api/auth/login，成功后自动持久化
- `cloudRegister(serverUrl, username, email, password)` — POST /api/auth/register，成功后自动持久化

## 关键词
### 函数
- `getStoredCloudAuth`
- `getCloudServerUrl`
- `setCloudServerUrl`
- `saveCloudAuth`
- `clearCloudAuth`
- `isCloudLoggedIn`
- `cloudLogin`
- `cloudRegister`

### 接口
- `CloudAuthResult`
- `StoredCloudAuth`
