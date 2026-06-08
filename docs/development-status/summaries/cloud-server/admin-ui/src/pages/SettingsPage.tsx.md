# `cloud-server/admin-ui/src/pages/SettingsPage.tsx`

## 功能
Admin UI 全局设置页面。包含容错配置、代理转发、ActiNet 模型映射、WebSocket 认证、邮件服务（SMTP）配置、**内置邮件服务器配置**、**邮箱发送冷却时间**、**待验证账户保留时长**、上游超时、站点地址、服务器端口/日志级别/健康检查间隔等设置卡片。所有变更通过「保存」按钮原子提交。v16：加载态改为 `SkeletonStats` 骨架屏 + 页面副标题。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchSettings`, `updateSettings`, `sendTestEmail`, `ServerSettings`, `SmtpSettings`, `MailServerSettings`
- `cloud-server/admin-ui/src/components/Skeleton.tsx` — `SkeletonStats`

### 提供
- `SettingsPage` — React 组件（default export）

### 被依赖
- `cloud-server/admin-ui/src/App.tsx` — 路由 `/settings`

## 关键词
### 函数
- `SettingsPage` — 主组件
- `load` — 加载当前设置
- `handleSave` — 保存设置
- `handleTestEmail` — 发送测试邮件
