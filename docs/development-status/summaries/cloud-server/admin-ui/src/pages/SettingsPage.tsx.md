# `cloud-server/admin-ui/src/pages/SettingsPage.tsx`

## 功能
全局设置页面。v16: 移除了"服务器信息（只读）"卡片，新增"服务器运行参数"卡片（port/logLevel/healthCheckIntervalMs 可编辑）和代理转发卡片中的 `upstreamTimeoutMs` 字段。

可配置项：容错配置（`defaultFaultTolerance`）、代理转发（`proxyUrl`、`upstreamTimeoutMs`）、WebSocket 认证（`wsAuth`）、邮件服务（SMTP/DKIM/冷却时间）、站点地址（`siteUrl`）、ActiNet 模型映射（`actiNetModelMapping`）、服务器运行参数（`port`、`logLevel`、`healthCheckIntervalMs`）。port 修改需重启生效，logLevel 和 healthCheckIntervalMs 支持热重载。设置即时生效并持久化到 `config.json`。容错链为两层：上游 `key_fault_tolerance` → 全局 `defaultFaultTolerance`。设置保存后显示成功提示 3 秒自动消失。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchSettings`、`updateSettings`、`sendTestEmail`、`ServerSettings`、`SmtpSettings`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`
