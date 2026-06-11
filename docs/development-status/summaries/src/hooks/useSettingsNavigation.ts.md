# `src/hooks/useSettingsNavigation.ts`
从 `src/App.tsx` 提取（Phase 2 — 步骤 4）。管理设置页面导航、滚动位置记忆、抽屉→设置过渡。
## 关系
### 调用 / 引用
- `src/state/ui-store.ts` — UI 导航状态
- `src/state/settings-store.ts` — 设置数据
- `src/state/extensions-store.ts` — 技能/运行时数据
- `src/utils/app-module.ts` — `createProviderNumericSettingDrafts`
### 提供
- `useSettingsNavigation` — 导航函数
### 被依赖
- `src/App.tsx`
