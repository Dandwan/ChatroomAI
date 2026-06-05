# `cloud-server/src/email/smtp-server.ts`

## 功能
内置 SMTP 服务端。使用 `smtp-server` npm 包在 127.0.0.1 上监听邮件提交（仅 localhost），将收到的邮件直接传递给 `direct-delivery.ts` 引擎进行 MX 直连投递。提供生命周期管理（start/stop）+ 热重载 DKIM/主机名配置。

## 关系
### 调用 / 引用
- `smtp-server` — `SMTPServer`
- `cloud-server/src/config.ts` — `DkimConfig`
- `cloud-server/src/logger.ts` — `createLogger`
- `cloud-server/src/email/direct-delivery.ts` — `enqueueDelivery`、`startDeliveryEngine`、`stopDeliveryEngine`、`updateDkimConfig`、`updateHeloHostname`、`DeliveryEnvelope`

### 提供
- `startSmtpServer(port, hostname, dkim?)` — 启动 SMTP 服务端和投递引擎，返回 `boolean`
- `stopSmtpServer()` — 优雅关闭 SMTP 服务端和投递引擎，返回 `Promise<void>`
- `isSmtpServerRunning()` — 查询服务端运行状态，返回 `boolean`
- `hotReloadDkim(dkim)` — 热重载 DKIM 配置
- `hotReloadHostname(hostname)` — 热重载 HELO 主机名

### 被依赖
- `cloud-server/src/email/email-service.ts`
- `cloud-server/src/admin/admin-routes.ts`

## 关键词
### 函数
- `startSmtpServer`
- `stopSmtpServer`
- `isSmtpServerRunning`
- `hotReloadDkim`
- `hotReloadHostname`
