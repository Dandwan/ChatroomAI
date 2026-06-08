# `cloud-server/admin-ui/src/components/CommandPalette.tsx`

## 功能
命令面板组件（v16 新增）。⌘K/Ctrl+K 唤起的全局页面跳转器：搜索框 + 按 4 组聚合的页面列表，支持模糊匹配（中文标签 / 拼音关键词 / 分组名）、↑↓ 键导航、Enter 选中、Esc 关闭、点击遮罩关闭。导出全站共享的 `Page` 联合类型。

## 关系
### 提供
- `CommandPalette` — 命令面板组件（props: open / onClose / onNavigate）
- `Page` — 页面 key 联合类型（全站共享，App.tsx 与 Layout.tsx 引用）

### 被依赖
- `cloud-server/admin-ui/src/components/Layout.tsx`
- `cloud-server/admin-ui/src/App.tsx`（仅 `Page` 类型）

## 关键词
### 函数
- `CommandPalette`

### 常量
- `ITEMS` — 10 个页面的命令项定义（label/group/keywords）
