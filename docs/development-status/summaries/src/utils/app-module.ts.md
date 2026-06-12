# `src/utils/app-module.ts`

## 功能
应用模块化工具函数集。提供设置加载/保存、模型选项计算、模型选择验证、请求配置解析、providers/numeric 设置转换等共享工具函数。

**近期变更（2026-06-12）**：
- `getEnabledModelOptions` 新增第四参数 `actiNetAdvancedModelsEnabled`，改用 `getVisibleActiNetModels()` 替代 `getEffectiveActiNetModels()` 进行模型可见性过滤
- `ensureValidCurrentModelSelection` 改用 `getVisibleActiNetModels()` 验证当前选中模型可见性，传递新参数到 `getEnabledModelOptions`

## 关系
### 调用 / 引用
- `src/state/types.ts` — `AppSettings`, `ProviderConfig`, `ProviderModel`, `EnabledModelOption` 等类型
- `src/state/extensions-store.ts` — `useExtensionsStore`
- `src/services/actinet-models.ts` — `getEffectiveActiNetModels`, `getVisibleActiNetModels`
- `src/services/cloud-auth.ts` — `isCloudLoggedIn`, `getStoredCloudAuth`, `getCloudServerUrl`

### 提供
- `DEFAULT_SETTINGS` — 默认设置常量
- `loadSettings` / `saveSettings` — 设置持久化
- `getEnabledModelOptions` — 计算聊天模型选择器可用选项
- `ensureValidCurrentModelSelection` — 验证并修正当前模型选择
- `resolveProviderRequestSettings` — 解析当前提供商的请求配置
- `ACTINET_PROVIDER_ID` / `ACTINET_PROVIDER_NAME` — ActiNet 虚拟提供商常量
- `providersToSettings` / `numericSettingsToProviderConfig` — Provider 配置转换
- `settingsToNumericSettings` / `settingsToProviderNumericSettings` — 数值设置提取

### 被依赖
- `src/App.tsx` — 使用 `getEnabledModelOptions`, `ensureValidCurrentModelSelection`, `resolveProviderRequestSettings`, `DEFAULT_SETTINGS`, `loadSettings` 等
- `src/hooks/useAssistant.ts` — 导入 `getEnabledModelOptions`, `ACTINET_PROVIDER_ID`, `ACTINET_PROVIDER_NAME`
- `src/hooks/useSettings.ts` — 使用多个工具函数
- `src/views/SettingsPage.tsx` — 使用 `getEnabledModelOptions`

## 关键词
### 常量
- `DEFAULT_SETTINGS`
- `ACTINET_PROVIDER_ID`
- `ACTINET_PROVIDER_NAME`

### 函数
- `loadSettings`
- `saveSettings`
- `getEnabledModelOptions`
- `ensureValidCurrentModelSelection`
- `resolveProviderRequestSettings`
- `providersToSettings`
- `numericSettingsToProviderConfig`
- `settingsToNumericSettings`
- `settingsToProviderNumericSettings`
