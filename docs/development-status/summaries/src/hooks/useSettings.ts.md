# `src/hooks/useSettings.ts`

## 功能
设置管理 hook。管理设置更新、provider 配置和模型选择。提取自 `src/App.tsx`。

## 关系
### 调用 / 引用
- `src/state/settings-store.ts` — `useSettingsStore`（设置状态）
- `src/state/ui-store.ts` — `useUIStore`（导航状态）
- `src/utils/app-module.ts` — `ensureValidCurrentModelSelection`, `resolveProviderRequestSettings` 等
- `src/utils/app-formatting.ts` — `clamp`

### 提供
- `useSettings` — 返回设置状态、numeric handlers、provider CRUD、model 管理函数

### 被依赖
- `src/App.tsx` — 计划使用（待集成）

## 关键词
### 函数
- `useSettings` — hook 主函数
- `applySettingsUpdate` — 核心设置更新函数
- `handleNumericSettingChange` / `handleProviderNumericSettingChange` — 数值输入
- `updateProviderById` / `addProvider` / `deleteProvider` — provider CRUD
- `selectCurrentModel` / `setProviderModelEnabled` — model 管理
