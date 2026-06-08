# [063] — Admin UI 视觉重做：夜色控制台（Nightfall Console）

**日期**：2026-06-08 22:30 +08:00

## 范围

重新设计 `cloud-server/admin-ui`（ActiNet 管理后台）的整体视觉与交互。视觉方向：**Nightfall Console（夜色控制台）**，Linear / Raycast 工艺，单一暖金强调，与产品官网 `website/`（"夜色山水"）同源（共用宣纸暖白文字基因，官网用金、后台此前用蓝 → 现统一为金）。范围为"完整重做 + 新交互"，不改动任何业务逻辑、API 调用、数据模型或后端代码。

附带修复一个长期隐患：admin-ui 下 19 个 `.tsx` 的 TypeScript 编译产物 `.js`（`tsconfig` 为 `noEmit`，本不该存在）被误提交/残留。`main.tsx` 以 `import App from './App.js'` 形式引用，Vite 解析 `.js` 时可能命中过期产物，导致"改了不生效"。

## 变更的代码区域

### 设计系统
- `src/styles/admin.css` — **整套重写**。新 token：`--bg #0b0d13`、`--surface #14161f`、`--surface-2`、`--text #f4efe7`、`--accent #c8a86b`（暖金，替换 `#6c8cd9`）、语义色压低饱和、8pt 间距、三档圆角、克制阴影。新增组件类：品牌徽标、⌘K 入口、分组导航、顶栏/面包屑/实时脉冲点、骨架屏、图形化空状态、命令面板、登录品牌区。补齐历史孤儿类（`.admin-btn-secondary`/`.admin-page-desc`/`.admin-section-title`/`.admin-table-wrapper`/`.admin-gap` 等）。新增 `--admin-*` 兼容别名变量（ActiStationPage 内联样式此前引用了未定义变量，导致样式失效，本次修复）。保留全部原 class 名以兼容未改动页面。`prefers-reduced-motion` 降级。

### 组件
- `src/components/Layout.tsx` — **重写**。品牌徽标 + ⌘K 入口 + 4 组分类导航（概览/流量/用户/发布与站点，hairline SVG 图标）+ sticky 顶栏（面包屑）+ 用户头像。监听 ⌘K/Ctrl+K 唤起命令面板。
- `src/components/CommandPalette.tsx` — **新增**。⌘K 命令面板，模糊搜索 + 键盘导航 + 分组列表。导出全站共享 `Page` 类型。
- `src/components/Skeleton.tsx` — **新增**。`SkeletonTable` / `SkeletonStats` 骨架屏。
- `src/components/EmptyState.tsx` — **新增**。图形化空状态。
- `src/components/UsageChart.tsx` — 线色 `#6c8cd9` → `#c8a86b`。
- `src/components/AvailabilityChart.tsx` — `COLORS` 调色板改为夜色控制台同源色序。

### 页面（仅视觉/加载态，无逻辑变更）
- `src/App.tsx` — `Page` 类型改为从 `CommandPalette` 导入（消除重复定义）。
- `src/pages/LoginPage.tsx` — 新增品牌区（金色徽标 + 副标题）。
- `src/pages/DashboardPage.tsx` — 加载态 → `SkeletonStats`，新增页面副标题。
- `src/pages/UsersPage.tsx`、`UpstreamsPage.tsx`、`ModelPrioritiesPage.tsx`、`SoftwareUpdatesPage.tsx` — 加载态 → `SkeletonTable`，新增页面副标题。
- `src/pages/ApiKeysPage.tsx` — 加载态 → `SkeletonTable`，空列表 → `EmptyState`，新增页面副标题。
- `src/pages/SettingsPage.tsx` — 加载态 → `SkeletonStats`，新增页面副标题。

### 清理
- 删除 19 个 `.js` 编译产物（10 个 git 跟踪 + 9 个未跟踪）。
- 新增 `cloud-server/admin-ui/.gitignore` — 忽略 `src/**/*.js`、`dist/`、`*.tsbuildinfo`，防止 `tsc` 再生成产物污染源码树。

### v0 预览（设计确认用，非生产代码）
- `cloud-server/admin-ui/design-preview.html` — 自包含静态预览，用于 web-design v0 关卡确认方向。

## 验证

- `npm run build`（`tsc -b && vite build`）**通过，零 TS 报错**，39 modules transformed，CSS 19.94 kB / JS 446 kB。
- 确认构建后 `src/` 下无 `.js` 重新生成（`noEmit` + `.gitignore`）。
- 扫描确认无残留旧 token 引用（`--admin-*` 别名已补齐）、无残留"加载中…"文字（除 HealthPage 刷新按钮的内联文案，属正常）。
- **未做**：浏览器/真机逐页人工视觉走查（环境无头）；建议下一步用 `npm run dev` 在浏览器逐页确认。

## 决策关卡
- 方案已提出：是（plan mode，含设计系统声明 + 工程方案 + 三个疑问）
- 用户确认已收到：是
  - 视觉方向：夜色控制台（暖金）
  - 范围：完整重做 + 新交互
  - 重做目标：admin-ui（非产品官网）
  - v0 预览方向：已确认
  - `.js` 删除 / 4 组导航 / 命令面板：按方案默认值执行（用户确认 v0 后未提异议）

## 提交
- 待创建：仅含本次 admin-ui 改动 + 对应 summaries + 本交接文件 + 30-current-state 更新。工作树极脏（大量无关已改文件），将选择性暂存隔离本次改动。

## 已知风险 / 待解决
- 仍需浏览器/真机逐页视觉走查，确认无溢出、对比度达标、图表色在深色下可辨。
- ActiStationPage 内联样式仍依赖 `--admin-*` 别名变量（已补齐）；未来可重构为 class。
- StatCard.tsx 未改动（仅经 CSS 受益），故未建摘要。

## 建议下一步
- `cd cloud-server/admin-ui && npm run dev`，逐页核对 11 个页面（尤其 Upstreams 嵌套表单、Logs SSE、Settings 长表单）。
- 部署：admin-ui 构建产物输出到 `cloud-server/src/admin/public`，随 cloud-server 部署。
