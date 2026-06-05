# `cloud-server/src/auth/auth-service.ts`

## 功能
提供认证核心逻辑。包括用户登录（用户名/邮箱 + bcrypt 密码验证，返回 JWT + API Key）、用户注册（用户名/邮箱去重、密码哈希、API Key 生成、6 位数字邮箱验证码生成）、JWT 签发与验证、管理员种子用户创建。**v10: 新增邮箱验证支持 — `createUser()` 不再自动登录，`loginUser()` 检查验证状态，新增 `verifyEmail()` 和 `resendVerificationEmail()`。v11: 密码重置 + 邮箱更换 — 新增 `requestPasswordReset()`（生成 6 位数字 token，发送密码重置邮件）、`resetPassword()`（验证 token + 哈希新密码 + 更新）、`requestEmailChange()`（验证密码 + 存储 pending_email + 发送邮箱更换验证码）、`confirmEmailChange()`（验证 token + 将 pending_email 写入 email）。邮件发送改用 `../email/email-service.js` 的 `sendEmail()`。v12: 邮箱验证改为 6 位数字验证码输入模式（不再使用验证链接），提取共享 `generateNumericToken()` 函数统一生成数字 token。v13: 集成邮箱冷却机制 — `createUser()` 返回 `cooldownRemaining`，`requestEmailChange()` 返回 `'cooldown'`，`resendVerificationEmail()` 和 `requestPasswordReset()` 记录冷却日志但不暴露给调用方（安全模糊响应）。**

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`
- `cloud-server/src/email/email-service.ts` — `sendEmail`
- `bcryptjs` — 密码哈希与验证
- `jsonwebtoken` — JWT 签发与验证
- `uuid` — `v4`
- `node:crypto` — `randomBytes`

### 提供
- `generateApiKey()` — 生成 `csk_` 前缀的 API Key
- `hashPassword()` — bcrypt 12 轮密码哈希
- `verifyPassword()` — bcrypt 密码比对
- `generateJwtToken()` — JWT 签发
- `verifyJwtToken()` — JWT 验证
- `loginUser()` — 用户登录（用户名/邮箱 + 密码 → JWT + API Key，需先验证邮箱）
- `createUser()` — 创建新用户（去重 + 哈希 + Key 生成 + 验证 token + 发送验证邮件，传入 password_reset_token/password_reset_token_expires_at/pending_email 为 null）
- `verifyEmail()` — 验证邮箱（token → email_verified=1）
- `resendVerificationEmail()` — 重新发送验证邮件
- `requestPasswordReset()` — 请求密码重置（生成 6 位数字 token，发送密码重置邮件，1 小时有效）
- `resetPassword()` — 使用 token 重置密码
- `requestEmailChange()` — 请求更换邮箱（需密码确认，返回 'success' | 'user_not_found' | 'wrong_password' | 'email_taken'）
- `confirmEmailChange()` — 确认邮箱更换（token → pending_email → email）
- `seedAdminUser()` — 首次运行时创建默认管理员

### 被依赖
- `cloud-server/src/auth/auth-routes.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/admin/admin-routes.ts`
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `confirmEmailChange`
- `createUser`
- `generateApiKey`
- `generateJwtToken`
- `generateNumericToken`
- `hashPassword`
- `loginUser`
- `requestEmailChange`
- `requestPasswordReset`
- `resendVerificationEmail`
- `resetPassword`
- `seedAdminUser`
- `verifyEmail`
- `verifyJwtToken`
- `verifyPassword`

### 常量
- `API_KEY_PREFIX`
- `BCRYPT_ROUNDS`
- `RESET_TOKEN_EXPIRY_MS`
- `VERIFY_TOKEN_EXPIRY_MS`

### 类型
- `LoginResult`
