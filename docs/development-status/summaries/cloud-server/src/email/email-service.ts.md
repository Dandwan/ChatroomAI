# `cloud-server/src/email/email-service.ts`

## 功能
提供邮件发送服务。包括 SMTP transporter 管理（nodemailer 初始化/热重载/关闭）、邮件发送历史环形缓冲区（最多 20 条记录）、核心 `sendEmail()` 函数（支持 verify-email、password-reset、email-change、test 四种邮件类型），以及发送测试邮件的便捷函数 `sendTestEmail()`。

## 关系
### 调用 / 引用
- `nodemailer` — `createTransport`, `Transporter`
- `cloud-server/src/config.ts` — `SmtpConfig`
- `cloud-server/src/logger.ts` — `createLogger`
- `cloud-server/src/email/email-templates.ts` — `EmailType`, `TemplateVars`, `getTemplate`

### 提供
- `EmailSendRecord` — 邮件发送记录接口
- `getSendHistory()` — 获取发送历史（最新在前）
- `initMailer(smtp)` — 初始化/重建 nodemailer transporter，返回是否就绪
- `isMailerReady()` — 检查 transporter 是否已配置
- `sendEmail(opts)` — 核心发送函数，不抛异常，返回 boolean
- `sendTestEmail(smtp, to)` — 发送测试邮件，返回 `{ success, error? }`
- `SendEmailOptions` — sendEmail 的参数接口

### 被依赖
- `cloud-server/src/auth/email-service.ts`
- `cloud-server/src/admin/admin-routes.ts`

## 关键词
### 函数
- `recordSend`
- `getSendHistory`
- `initMailer`
- `isMailerReady`
- `sendEmail`
- `sendTestEmail`

### 接口/类型
- `EmailSendRecord`
- `SendEmailOptions`

### 常量
- `MAX_HISTORY`
