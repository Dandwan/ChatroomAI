# `src/views/SettingsPage.tsx`

## 功能
设置页主渲染组件——提取规划文件。记录了从 App.tsx 提取 16 个 renderSettings* 函数（约 1280 行）的完整边界和所需 props。

当前状态：skeleton（骨架已创建，待迁移渲染函数）。

## 关系
### 调用 / 引用
- `src/state/settings-store.ts` — 计划访问
- `src/state/ui-store.ts` — 计划访问
- `src/state/extensions-store.ts` — 计划访问
- `src/services/daily-cover.ts` — 导入 `ResolvedDailyCover` 类型

### 被依赖
- `src/App.tsx` — 计划替代内联 renderSettingsPage()

## 关键词
### 函数
- `SettingsPage` — 主组件（骨架）
### 常量
- `SETTINGS_PAGE_EXTRACTION_PLAN` — 提取规划元数据
