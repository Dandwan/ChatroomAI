# `cloud-server/admin-ui/src/pages/SettingsPage.tsx`

## 功能
全局设置页面。允许管理员配置全局默认容错次数（`defaultFaultTolerance`），即时生效并持久化到 `config.json`。同时展示只读的服务器信息（端口、健康检查间隔、日志级别）。设置保存后显示成功提示 3 秒自动消失。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchSettings`、`updateSettings`、`ServerSettings`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`
