# `cloud-server/admin-ui/src/pages/LogsPage.tsx`

## 功能
请求日志查看页面。支持分页显示最近 24 小时日志（50 条/页），按状态（成功/失败）筛选。提供 SSE 实时推送开关：开启后通过 EventSource 连接 `/api/admin/logs/stream`，新日志自动追加到表格顶部（绿色渐入动画，最多保留 200 条）。关闭后恢复手动分页模式。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchLogs`、`getLogsStreamUrl`、`LogEntry`

### 提供
- `LogsPage()` — default export

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`
