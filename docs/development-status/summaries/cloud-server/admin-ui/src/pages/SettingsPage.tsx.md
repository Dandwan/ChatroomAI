# `cloud-server/admin-ui/src/pages/SettingsPage.tsx`

## 功能
全局设置页面。允许管理员配置全局默认容错次数（`defaultFaultTolerance`）、ActiNet 模型映射（`actiNetModelMapping`）、代理转发（`proxyUrl`）、WebSocket 认证（`wsAuth`）、SMTP 邮件服务、站点地址（`siteUrl`）。ActiNet 映射部分提供"快速"和"专家"两个文本输入框，将 ActiNet 客户端使用的友好名称映射到实际上游模型名（留空则透传原名称）。SMTP 卡包含主机/端口/用户名/密码/发件人字段，以及**测试邮件功能（输入收件人邮箱 + 发送按钮 + 成功/失败反馈）**。设置即时生效并持久化到 `config.json`。容错链为两层：上游 `key_fault_tolerance` → 全局 `defaultFaultTolerance`。同时展示只读的服务器信息（端口、健康检查间隔、日志级别）。设置保存后显示成功提示 3 秒自动消失。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchSettings`、`updateSettings`、`sendTestEmail`、`ServerSettings`、`SmtpSettings`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`
