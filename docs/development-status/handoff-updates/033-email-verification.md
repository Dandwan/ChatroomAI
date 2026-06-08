# 033 — 注册账号邮箱验证

**日期**：2026-06-05

## 范围

为 cloud-server 新增邮箱验证机制。用户注册后不再自动登录，而是发送验证邮件（含验证链接），用户点击链接验证邮箱后才能登录。同时在 Admin UI 提供 SMTP 配置页面。

## 变更的代码区域

### 新建：`cloud-server/src/auth/email-service.ts`
- `sendVerificationEmail(smtp, to, username, verifyUrl)` — 使用 nodemailer 发送纯文本中文验证邮件
- `initMailer(smtp)` — SMTP transporter 初始化/重初始化
- SMTP 未配置时静默返回 false，不抛异常

### 修改：`cloud-server/src/types.ts`
- `User` 接口新增 `email_verified`、`email_verify_token`、`email_verify_token_expires_at`
- **新建** `SmtpConfig` 接口（host, port, user, pass, from）

### 修改：`cloud-server/src/config.ts`
- `ServerConfig` 新增 `smtp: SmtpConfig` 和 `siteUrl: string`
- `loadConfig()` — 从环境变量和 `config.json` 加载 SMTP 配置
- `reloadConfigFromFile()` — 支持 SMTP 和 siteUrl 热重载

### 修改：`cloud-server/src/db/migrations.ts`
- 新增 v6 迁移：`users` 表添加 3 列（email_verified, email_verify_token, email_verify_token_expires_at），已有用户自动标记为已验证

### 修改：`cloud-server/src/db/repositories/user-repo.ts`
- `userFromRow()` — 解析 3 个新字段
- `create()` — INSERT 包含新列
- **新增** `findByVerifyToken(token)` — 按验证 token 查找用户
- **新增** `verifyUserEmail(id)` — 标记已验证并清除 token
- **新增** `updateVerifyToken(id, token, expiresAt)` — 更新验证 token

### 修改：`cloud-server/src/auth/auth-service.ts`
- `createUser()` — 生成验证 token（24h 过期），调用 `sendVerificationEmail()`，**不再自动登录**（不返回 api_key）
- `loginUser()` — 新增邮箱验证状态检查，返回 `'EMAIL_NOT_VERIFIED'` 阻止登录
- **新增** `verifyEmail(token)` — 验证邮箱并返回 api_key
- **新增** `resendVerificationEmail(email)` — 重新发送验证邮件

### 修改：`cloud-server/src/auth/auth-routes.ts`
- `POST /api/auth/register` — 响应改为 `201 { message, email_sent, user }`，不再返回 token/api_key
- `POST /api/auth/login` — `email_verified=0` 时返回 `403 EMAIL_NOT_VERIFIED`
- **新增** `POST /api/auth/verify-email` — 接受 `{ token }`，验证成功返回 api_key
- **新增** `POST /api/auth/resend-verification` — 接受 `{ email }`，IP 限流 1次/2分钟

### 修改：`cloud-server/src/admin/admin-routes.ts`
- `GET /api/admin/settings` — 响应新增 `smtp` 和 `siteUrl`
- `PUT /api/admin/settings` — 接受并持久化 `smtp` 和 `siteUrl`，含完整验证

### 修改：`cloud-server/admin-ui/src/api.ts`
- **新增** `SmtpSettings` 接口
- `ServerSettings` 新增 `smtp`、`siteUrl`
- `updateSettings` 参数新增 `smtp`、`siteUrl`

### 修改：`cloud-server/admin-ui/src/pages/SettingsPage.tsx`
- 新增「邮件服务（SMTP）」配置卡片（主机、端口、用户名、密码、发件人地址）
- 新增「站点地址」配置卡片（验证链接基础 URL）
- 密码字段使用 `type="password"`
- `handleSave` 提交 SMTP 和 siteUrl

### 修改：`src/services/cloud-auth.ts`
- **新增** `CloudRegisterResult` 接口
- `cloudRegister()` — 返回 `CloudRegisterResult`（不再自动登录），仅保存凭据不保存 token
- **新增** `verifyCloudEmail(serverUrl, token)` — 调用验证端点，成功后保存 api_key
- **新增** `resendCloudVerification(serverUrl, email)` — 请求重发验证邮件

### 修改：`src/components/CloudAuthForm.tsx`
- 注册成功后显示验证提示界面（替代自动登录）：
  - 显示服务器返回的消息
  - 「重新发送验证邮件」按钮
  - 「返回登录」按钮
- 新增 `registerResult` 状态管理验证后视图

### 修改：`src/styles/app-editorial-redesign.css`
- 新增 `.cover-auth-notice` 样式（绿色提示，用于重发验证邮件成功消息）

### 修改：`cloud-server/package.json`
- 新增依赖 `nodemailer`、`@types/nodemailer`

## 设计决策

1. **nodemailer SMTP**：Node.js 生态标准邮件库，零额外服务依赖
2. **SMTP 可选**：未配置时注册 token 直接通过 API 响应返回（调试模式），warn 日志提示
3. **24 小时 token 过期**：标准邮箱验证流程，过期可重发
4. **已有用户自动验证**：v6 迁移中 `UPDATE users SET email_verified = 1`
5. **邮件发送失败不阻塞**：账号保留，前端提供重发按钮
6. **验证后返回 api_key 但不返回 JWT**：用户需登录获取 JWT（api_key 已可用于 API 调用）

## 数据流

```
注册: POST /register → createUser → sendVerificationEmail → 201 { email_sent, message }
登录: POST /login → loginUser → email_verified? → 403 或 200 JWT
验证: POST /verify-email → verifyEmail → email_verified=1 → 200 { api_key }
重发: POST /resend-verification → resendVerificationEmail → 200 { message }
```

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npx tsc --noEmit` — 主项目：零错误
- `npm run build` — admin-ui：构建成功（390 KB JS, 8.5 KB CSS）

## 决策关卡

- 方案已提出：是（含最终版工程方案、设计决策、数据流）
- 用户确认已收到：是
- 确认内容：
  1. SMTP 配置需要 Admin UI 配置页面
  2. 已有用户自动标记为 email_verified=1
  3. 使用纯文本中文邮件
  4. 邮件发送失败时保留账号，允许重发

## 已知限制

- SMTP 密码在 Admin UI 回传时不会自动填充原始值（`type="password"` 安全策略）
- 邮件发送依赖 SMTP 服务器可用性，无内置重试队列
- `siteUrl` 配置后验证链接才能工作，未配置时 token 在注册 API 响应中返回
- 已有 pre-existing `tsc -b` 构建失败（`authVersion` 未使用）与本次变更无关

## 下一步

- 部署后在 Admin UI 配置 SMTP 服务器信息
- 设置 `CLOUD_SERVER_SITE_URL` 环境变量或通过 Admin UI 配置 siteUrl
- 测试完整注册→验证→登录流程
- 可选：添加 Admin UI 中的「测试邮件」按钮验证 SMTP 配置
