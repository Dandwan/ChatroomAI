# `cloud-server/admin-ui/src/components/Layout.tsx`

## 功能
Admin UI 布局组件（v16 夜色控制台重做）。左侧固定导航栏：品牌徽标区 + ⌘K 搜索入口 + **4 组分类导航**（概览：仪表盘/健康/日志；流量：上游管理/模型策略；用户：用户管理/API 密钥；发布与站点：软件更新/ActiStation/全局设置，每项带 hairline 单线 SVG 图标）+ 底部用户头像/用户名/退出。右侧含 sticky 顶栏（面包屑显示当前页标题）+ 主内容区。监听 ⌘K/Ctrl+K 全局快捷键唤起命令面板。导航项与 `Page` 类型来自 `CommandPalette`。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/auth-context.js` — `useAuth`
- `cloud-server/admin-ui/src/components/CommandPalette.tsx` — `CommandPalette` 组件、`Page` 类型

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`

## 关键词
### 函数
- `Layout`

### 常量
- `PAGE_TITLES` — 页面 → 中文标题映射（面包屑用）
- `NAV_GROUPS` — 4 组导航定义
- `I` — hairline SVG 图标集
