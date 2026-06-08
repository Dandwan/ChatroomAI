# `cloud-server/admin-ui/src/components/UsageChart.tsx`

## 功能
用量折线图组件（Chart.js）。渲染单条折线（每小时 Token / 请求数）。v16：线色由柔和蓝 `#6c8cd9` 改为暖金 `#c8a86b`，与夜色控制台强调色一致。

## 关系
### 调用 / 引用
- `chart.js` — Chart 及折线图相关注册项

### 提供
- `UsageChart` — 折线图组件（props: labels / data / label）

### 被依赖
- `cloud-server/admin-ui/src/pages/DashboardPage.tsx`

## 关键词
### 函数
- `UsageChart`
