# `cloud-server/admin-ui/src/styles/admin.css`

## 功能
Admin UI 全局样式表。**v16（夜色控制台重做）：整套设计系统重写为 "Nightfall Console"——暖黑底 (`--bg #0b0d13`) + 宣纸暖白文字 (`--text #f4efe7`) + 单一暖金强调 (`--accent #c8a86b`，替换原柔和蓝 `#6c8cd9`)，与产品官网"夜色山水"同源。** 8pt 间距网格、三档圆角 (`--r-sm/md/lg`)、tabular-nums 全站数字对齐。新增组件类：`.admin-nav-brand-mark`/`.admin-nav-brand-text`（品牌徽标）、`.admin-nav-cmdk`/`.admin-kbd`（⌘K 入口）、`.admin-nav-group-title`（分组导航标题）、`.admin-nav-avatar`（用户头像）、`.admin-topbar`/`.admin-crumb`/`.admin-dot-live`（顶栏+面包屑+实时脉冲点）、`.admin-skeleton`/`.admin-sk-row`（骨架屏）、`.admin-empty-mark`/`.admin-empty-title`/`.admin-empty-desc`（图形化空状态）、`.admin-cmdk-*`（命令面板：overlay/input/list/group/item）、`.admin-login-brand`/`.admin-login-mark`/`.admin-login-sub`（登录品牌区）。导航 active 态左侧金色指示条。补齐历史孤儿类：`.admin-btn-secondary`/`.admin-bg-secondary`/`.admin-border`/`.admin-field-hint`/`.admin-page-desc`/`.admin-section-title`/`.admin-table-wrapper`/`.admin-gap`/`.admin-text-muted`。新增 `--admin-*` 兼容别名变量（供 ActiStationPage 内联样式使用，此前这些变量未定义导致样式失效）。`prefers-reduced-motion` 降级。保留全部原有 class 名以兼容未改动页面。

## 关系
### 被依赖
- `cloud-server/admin-ui/src/main.tsx` / `index.html`
