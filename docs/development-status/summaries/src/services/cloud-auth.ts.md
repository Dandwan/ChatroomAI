# `src/services/cloud-auth.ts`

## 功能
提供 ActiChat 云服务（ActiNet）前端的认证服务层。包含用户登录、注册、**邮箱验证**、**密码重置**、**邮箱更换**、本地认证状态持久化、凭据管理、自动登录等功能。所有认证令牌和用户信息持久化到 `localStorage`。内置默认服务器地址 `DEFAULT_CLOUD_SERVER_URL`，`getCloudServerUrl()` 在没有已保存地址时自动回退到默认值。

密码使用 Base64 编码混淆后存储在独立的 `actichat_cloud_credentials` key 中，与 auth token 分离。启动时若 token 无效但有已存凭据，可自动尝试登录。

**v11: 新增 `CloudUserInfo` 接口、`StoredCloudAuth.emailVerified` 字段、`fetchCloudUserInfo()`、`requestCloudPasswordReset()`、`resetCloudPassword()`、`changeCloudEmail()`、`confirmCloudEmailChange()`。**

## 关系
### 调用 / 引用
- `src/components/CloudAuthForm.tsx` — 使用 `cloudLogin`、`cloudRegister`、`getCloudServerUrl`、`resendCloudVerification`、**`requestCloudPasswordReset`**、**`resetCloudPassword`**
- `src/components/CloudLoginPage.tsx` — 使用 `cloudLogin`
-  **`src/components/settings/ActiNetSettings.tsx` — 使用 `fetchCloudUserInfo`、`changeCloudEmail`、`confirmCloudEmailChange`、`saveCloudAuth`、`CloudUserInfo`**
- `src/App.tsx` — 使用 `isCloudLoggedIn` 判断登录状态，`tryAutoLogin`/`hasStoredCredentials` 实现启动自动登录

### 提供
- `DEFAULT_CLOUD_SERVER_URL` — 默认云服务器地址常量（开发时修改）
- `CloudAuthResult` — 认证响应接口（token、api_key、user）
- `CloudRegisterResult` — 注册响应接口（message、email_sent、user）
- `CloudUserInfo` — **用户信息接口（id、username、email、email_verified、api_key、rate_limit_rpm、rate_limit_tpd）**
- `StoredCloudAuth` — 本地存储的认证状态接口（含可选 `emailVerified?: boolean`）
- `getStoredCloudAuth()` — 从 localStorage 读取已保存的认证信息
- `getCloudServerUrl()` — 获取服务器地址（已保存值 → 默认值回退）
- `setCloudServerUrl(url)` — 持久化服务器地址
- `saveCloudAuth(auth)` — 持久化认证信息
- `clearCloudAuth()` — 硬退出：完全清除认证信息和凭据
- `deactivateCloudAuth()` — 软退出：保留 username/email/serverUrl 和凭据，仅清除 token/apiKey
- `isCloudLoggedIn()` — 判断是否已登录（有 apiKey）
- `verifyCloudAuth()` — 验证 token 有效性（GET /api/auth/me），用于启动时连通性检测
- `fetchCloudUserInfo()` — **获取当前用户完整信息（GET /api/auth/me，Bearer apiKey），返回 `CloudUserInfo | null`**
- `hasStoredCredentials()` — 判断是否有可用于自动登录的凭据
- `tryAutoLogin()` — 用已存凭据尝试登录，成功返回 true，失败静默返回 false
- `cloudLogin(serverUrl, username, password)` — POST /api/auth/login，成功后自动持久化 auth 和凭据
- `cloudRegister(serverUrl, username, email, password)` — POST /api/auth/register，成功后仅保存凭据，不自动登录
- `verifyCloudEmail(serverUrl, token)` — POST /api/auth/verify-email，成功后保存 api_key
- `resendCloudVerification(serverUrl, email)` — POST /api/auth/resend-verification
- `requestCloudPasswordReset(serverUrl, email)` — **POST /api/auth/forgot-password，请求密码重置**
- `resetCloudPassword(serverUrl, token, password)` — **POST /api/auth/reset-password，使用重置码设置新密码**
- `changeCloudEmail(serverUrl, apiKey, newEmail, password)` — **POST /api/auth/change-email（Bearer 认证），请求更换绑定邮箱**
- `confirmCloudEmailChange(serverUrl, token)` — **POST /api/auth/confirm-email-change，确认邮箱更换**

## 关键词
### 常量
- `DEFAULT_CLOUD_SERVER_URL`

### 函数
- `getStoredCloudAuth`
- `getCloudServerUrl`
- `setCloudServerUrl`
- `saveCloudAuth`
- `clearCloudAuth`
- `deactivateCloudAuth`
- `isCloudLoggedIn`
- `verifyCloudAuth`
- `fetchCloudUserInfo`
- `hasStoredCredentials`
- `tryAutoLogin`
- `cloudLogin`
- `cloudRegister`
- `verifyCloudEmail`
- `resendCloudVerification`
- `requestCloudPasswordReset`
- `resetCloudPassword`
- `changeCloudEmail`
- `confirmCloudEmailChange`

### 接口
- `CloudAuthResult`
- `CloudRegisterResult`
- `CloudUserInfo`
- `StoredCloudAuth`
