# `src/hooks/useSettings.ts`

## 功能
设置管理 hook。管理设置更新、provider 配置、模型选择、provider 模型拉取/测试、提示词重置。提取自 `src/App.tsx`。

**近期变更（2026-06-12）**：
- 修复 ActiNet 模型选择静默失败（P0 Bug #7）：`selectCurrentModel` 中硬编码 `'actinet'` 改为 `ACTINET_PROVIDER_ID`，恢复 `getEffectiveActiNetModels()` 调用和 `m.enabled` 检查
- 修复 `deleteProvider` 缺少 modelHealth 清理（P1 Bug #8）：删除服务商时按 `providerId::` 前缀清理相关 modelHealth 条目

## 关系
### 调用 / 引用
- `src/state/settings-store.ts` — `useSettingsStore`（设置状态）
- `src/state/extensions-store.ts` — `useExtensionsStore`（modelHealth 管理）
- `src/state/ui-store.ts` — `useUIStore`（导航状态、isFetchingModelsByProviderId）
- `src/utils/app-module.ts` — `ensureValidCurrentModelSelection`, `resolveProviderRequestSettings`, `PROMPT_DEFAULTS`, `ACTINET_PROVIDER_ID` 等
- `src/services/actinet-models.ts` — `getEffectiveActiNetModels`
- `src/utils/app-formatting.ts` — `clamp`, `isRecord`
- `src/utils/model-utils.ts` — `createProviderModelKey`
- `src/services/chat-api.ts` — `buildApiUrl`, `authHeaders`, `readErrorMessage`

### 提供
- `useSettings` — 返回设置状态、numeric handlers、provider CRUD、model 管理、`fetchProviderModels`、`testProviderModel`、`resetPromptToDefault`

### 被依赖
- `src/App.tsx` — 解构使用

## 关键词
### 函数
- `useSettings` — hook 主函数
- `applySettingsUpdate` — 核心设置更新函数
- `handleNumericSettingChange` / `handleProviderNumericSettingChange` — 数值输入
- `updateProviderById` / `addProvider` / `deleteProvider` — provider CRUD（deleteProvider 含 modelHealth 清理）
- `selectCurrentModel` / `setProviderModelEnabled` — model 管理
- `fetchProviderModels` — 从 provider API 拉取模型列表
- `testProviderModel` — 测试单个模型连通性
- `resetPromptToDefault` — 重置提示词为默认值
