# `cloud-server/src/email/email-templates.ts`

## 功能
定义 ActiNet 云服务邮件模板。所有模板均为纯文本中文邮件，无 HTML。包含四种邮件类型：邮箱验证（6 位数字验证码，手动输入）、密码重置（6 位数字重置码）、邮箱更换验证（6 位数字验证码）、测试邮件。提供 `getTemplate()` 函数根据类型和变量生成邮件主题和正文。

## 关系
### 调用 / 引用
无外部依赖，纯模块内定义。

### 提供
- `EmailType` — 联合类型 `'verify-email' | 'password-reset' | 'email-change' | 'test'`
- `TemplateVars` — 模板变量接口（username, token?, newEmail?）
- `getTemplate(type, vars)` — 根据邮件类型返回 `{ subject, text }`

### 被依赖
- `cloud-server/src/email/email-service.ts`
- `cloud-server/src/auth/email-service.ts`

## 关键词
### 函数
- `getTemplate`

### 接口/类型
- `EmailType`
- `TemplateVars`
- `Template`
