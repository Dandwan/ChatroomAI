# 036 — 内置 SMTP 邮件服务器集成（MX 直投）

**日期**：2026-06-06

## 范围

在已有的邮箱验证（033）和邮件服务独立化（034）基础上，新增**内置 SMTP 服务器模式**。云服务不再依赖外部 SMTP 中继（QQ邮箱/Gmail等），可直接通过 DNS MX 查询 + SMTP 直投将邮件送达收件人。

保留原有外部 SMTP 模式作为备选，通过 `mailServer.mode` 配置切换。

分 6 个 Phase 实施，全部完成。

## 用户决策

1. 端口 25 可直接使用
2. 需要 DKIM 签名支持（提升送达率）
3. 保留外部 SMTP 模式作为备选
4. SMTP 服务端仅接受 localhost 连接（仅本应用使用）

## 核心架构

```
builtin 模式:
  App → email-service → nodemailer → 127.0.0.1:25
                                        ↓
                              smtp-server (内置)
                                        ↓
                              direct-delivery (MX查询 + SMTP直投)
                                        ↓
                              收件人邮件服务器

external 模式 (不变):
  App → email-service → nodemailer → 外部 SMTP → 收件人
```

## Phase 1：内置 SMTP 服务端

### 新建：`cloud-server/src/email/smtp-server.ts`
- 使用 `smtp-server` npm 包（nodemailer 同作者维护）
- 仅绑定 `127.0.0.1`，不接受外部连接
- `authOptional: true`（localhost 无需认证）
- `onData` 回调：读取原始邮件流 → Buffer → 调用 `enqueueDelivery()`
- `startSmtpServer(port, hostname, dkim?)` / `stopSmtpServer()` 生命周期
- `hotReloadDkim()` / `hotReloadHostname()` 热重载支持

## Phase 2：MX 直连投递引擎

### 新建：`cloud-server/src/email/direct-delivery.ts`
- `deliverEmail(envelope, rawEmail)`：
  1. 解析收件人域名
  2. `dns.promises.resolveMx(domain)` → 按优先级排序 MX 列表
  3. 逐个连接 MX 服务器，SMTP 握手（EHLO → MAIL FROM → RCPT TO → DATA → QUIT）
  4. 任意 MX 成功即返回 true
- 重试队列：内存 Map，最多 3 次，间隔 30s → 2min → 10min
- 并发控制：最多 5 个并发外发连接，30 秒超时
- DKIM 签名：`node:crypto` RSA-SHA256，在投递前插入 `DKIM-Signature` 头
- 无新增 npm 依赖（仅使用 `node:dns`、`node:net`、`node:crypto`）

## Phase 3：配置系统扩展

### 修改：`cloud-server/src/config.ts`
- 新增 `DkimConfig` 接口（enabled/domain/selector/privateKey）
- 新增 `MailServerConfig` 接口（mode/hostname/listenPort/dkim）
- `ServerConfig` 新增 `mailServer: MailServerConfig` 字段
- `loadConfig()` — 从环境变量和 `config.json` 加载，默认自动检测（有外部 SMTP → external，无 → builtin）
- `reloadConfigFromFile()` — 支持 `mailServer` 全部字段热重载
- 新增 7 个环境变量映射（`CLOUD_SERVER_MAIL_MODE` 等）

## Phase 4：邮件服务双模式集成

### 修改：`cloud-server/src/email/email-service.ts`
- `initMailer(smtp, mailServer?)` — 双模式支持：
  - builtin 模式 → `createTransport({ host: '127.0.0.1', port: listenPort })`
  - external 模式 → 现有逻辑不变
- `startBuiltinMailServer(config)` — 启动内置 SMTP 服务端
- `stopBuiltinMailServer()` — 停止服务端和投递引擎
- `hotReloadMailServerConfig(config)` — 热重载 DKIM/主机名
- `sendEmail()` — builtin 模式下注入 DKIM 签名参数（nodemailer 消息级）
- `sendTestEmail()` — 新增 `mailServer` 参数

### 修改：`cloud-server/src/app.ts`
- 导入 `startBuiltinMailServer`、`initMailer`
- 启动时：builtin 模式启动 SMTP 服务端并初始化 transporter

### 修改：`cloud-server/src/index.ts`
- 导入 `stopBuiltinMailServer`
- `shutdown()` 中调用 `stopBuiltinMailServer()`（在 `closeDatabase()` 之前）

### 修改：`cloud-server/src/watcher/config-watcher.ts`
- 导入 `hotReloadMailServerConfig`
- `mailServer` 配置变更时调用热重载

## Phase 5：Admin UI 配置界面

### 修改：`cloud-server/src/admin/admin-routes.ts`
- `GET /api/admin/settings` — 响应新增 `mailServer`
- `PUT /api/admin/settings` — 接受并验证 `mailServer`（含 DKIM），持久化到 `config.json`
- `POST /api/admin/email/test` — 传入 `mailServer` 配置
- `GET /api/admin/email/status` — 响应新增 `mail_mode`、`smtp_server_running`、`queue_size`

### 修改：`cloud-server/admin-ui/src/api.ts`
- 新增 `DkimSettings`、`MailServerSettings` 接口
- `ServerSettings` 新增 `mailServer`
- `EmailStatus` 新增 `mail_mode`、`smtp_server_running`、`queue_size`
- `updateSettings()` 参数新增 `mailServer`

### 修改：`cloud-server/admin-ui/src/pages/SettingsPage.tsx`
- 「邮件服务」卡片改造为双模式 UI：
  - 模式切换单选：内置服务器 / 外部 SMTP
  - 内置模式：监听端口、HELO 主机名、发件人地址
  - 外部模式：SMTP 主机/端口/用户名/密码/发件人（原样）
  - DKIM 配置：启用开关 + 域名/Selector/私钥（仅内置模式）
  - 保留测试邮件发送功能

## Phase 6：编译验证

- `npx tsc --noEmit` — cloud-server：**零错误**
- `npx tsc --noEmit` — admin-ui：**零错误**
- `npx tsc --noEmit` — 主项目：**零错误**
- `npm run build` — admin-ui：**构建成功**（413.6 KB JS, 9.0 KB CSS）

## 文件变更清单

### 新建（2 个）
```
cloud-server/src/email/smtp-server.ts     — 内置 SMTP 服务端
cloud-server/src/email/direct-delivery.ts  — MX 直连投递引擎
docs/development-status/summaries/cloud-server/src/email/smtp-server.ts.md
docs/development-status/summaries/cloud-server/src/email/direct-delivery.ts.md
```

### 修改（9 个）
```
cloud-server/package.json                  — 新增 smtp-server 依赖
cloud-server/src/config.ts                 — mailServer + DKIM 配置
cloud-server/src/email/email-service.ts    — 双模式 + DKIM + 生命周期
cloud-server/src/app.ts                    — SMTP 服务端启动集成
cloud-server/src/index.ts                  — 优雅关闭
cloud-server/src/watcher/config-watcher.ts — 邮件配置热重载
cloud-server/src/admin/admin-routes.ts     — 配置读写 + EmailStatus 增强
cloud-server/admin-ui/src/api.ts           — 新接口 + 类型
cloud-server/admin-ui/src/pages/SettingsPage.tsx — 双模式 UI
```

### 不变更
- `email-templates.ts` — 模板无需改动
- `auth-service.ts` — `sendEmail()` 调用接口不变
- `User` 类型 / DB schema — 无需迁移
- 客户端代码（CloudAuthForm / cloud-auth / ActiNetSettings）— 无影响

## 设计决策

1. **smtp-server 而非自行实现**：成熟的 SMTP 协议库，nodemailer 同作者维护，处理 pipelining/8BITMIME 等边界情况
2. **双模式共存**：`external` 和 `builtin` 通过 `mailServer.mode` 切换，不删除现有功能
3. **localhost-only 绑定**：SMTP 服务端仅监听 `127.0.0.1`，安全策略简单
4. **nodemailer 连接本地 SMTP**：复用现有 `sendEmail()` 接口，改造成本最小
5. **DKIM 在 nodemailer 消息层签名**：利用 nodemailer 内置 DKIM 支持，比在投递引擎层签名更简洁
6. **内存重试队列**：与现有发送记录一致（内存环形缓冲），不引入持久化复杂度
7. **node:crypto 签名**：DKIM RSA-SHA256 签名使用标准库，无需额外依赖
8. **config.json + 环境变量**：与现有配置体系完全一致

## 数据流

### builtin 模式验证邮件
```
POST /api/auth/register
  → createUser() → sendEmail({ type: 'verify-email', to: user@gmail.com })
    → transporter.sendMail({ from, to, subject, text, dkim })
      → nodemailer 连接 127.0.0.1:25
        → smtp-server onData() → read stream → Buffer
          → enqueueDelivery({ from, to }, rawEmail)
            → deliverEmail()
              → resolveMx('gmail.com') → [alt1.gmail-smtp-in.l.google.com:5, ...]
              → 连接 alt1.gmail-smtp-in.l.google.com:25
              → EHLO mail.actichat.app → MAIL FROM → RCPT TO → DATA → QUIT
              → 成功 → 记录发送历史
```

## 已知限制

1. **送达率依赖 DNS 配置**：需正确设置 SPF/DKIM/DMARC/PTR 记录，否则大型邮箱可能拒收
2. **内存队列**：服务重启后未投递邮件丢失
3. **端口 25 需要 root 或 CAP_NET_BIND_SERVICE**：生产环境建议 iptables 转发或 setcap
4. **DKIM 密钥需手动生成**：`openssl genrsa -out dkim_private.pem 2048` 后配置到 Admin UI
5. **模式切换需重启**：从 external 切换到 builtin 模式需要重启服务（SMTP 服务端需要重新绑定端口）

## 下一步

- 部署服务器后配置 DNS 记录（SPF/DKIM/DMARC/PTR）
- 生成 DKIM 密钥并配置到 Admin UI
- 发送测试邮件验证送达率
- 可选：邮件队列持久化、送达率统计 Dashboard
