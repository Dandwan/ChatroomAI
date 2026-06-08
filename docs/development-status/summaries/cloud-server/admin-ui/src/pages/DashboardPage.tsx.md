# `cloud-server/admin-ui/src/pages/DashboardPage.tsx`

## 功能
仪表盘页面。展示服务器状态（运行时间/内存/活跃连接/24h 请求）StatCard、用量概览 StatCard、每小时 Token/请求折线图、各上游用量表、上游可用性表与多线可用性图。每 30 秒自动刷新。v16：加载态由文字改为 `SkeletonStats` 骨架屏，新增页面副标题 `.admin-page-desc`。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchUsage` / `fetchAvailability` / `fetchServerMetrics` 及相关类型
- `cloud-server/admin-ui/src/components/StatCard.tsx` — `StatCard`
- `cloud-server/admin-ui/src/components/UsageChart.tsx` — `UsageChart`
- `cloud-server/admin-ui/src/components/AvailabilityChart.tsx` — `AvailabilityChart`
- `cloud-server/admin-ui/src/components/Skeleton.tsx` — `SkeletonStats`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`

## 关键词
### 函数
- `DashboardPage`
