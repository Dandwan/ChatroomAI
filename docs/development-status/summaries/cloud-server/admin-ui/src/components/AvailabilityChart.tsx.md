# `cloud-server/admin-ui/src/components/AvailabilityChart.tsx`

## 功能
上游可用性多线折线图组件（Chart.js）。每个上游一条线，渲染每小时可用性百分比（0–100%）。空数据时渲染 `.admin-empty`。v16：调色板 `COLORS` 改为夜色控制台同源色序（暖金打头：`#c8a86b/#7a93c4/#6cc98a/#d97a7a/#a78bdb/#d4b46a`）。

## 关系
### 调用 / 引用
- `chart.js` — Chart 及折线图相关注册项
- `cloud-server/admin-ui/src/api.ts` — `HourlyAvailability` 类型

### 提供
- `AvailabilityChart` — 多线折线图组件（props: data / upstreamNames / hours）

### 被依赖
- `cloud-server/admin-ui/src/pages/DashboardPage.tsx`

## 关键词
### 函数
- `AvailabilityChart`

### 常量
- `COLORS` — 多线调色板
