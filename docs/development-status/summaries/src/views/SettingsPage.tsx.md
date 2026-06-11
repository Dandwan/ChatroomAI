# `src/views/SettingsPage.tsx`

## 功能
设置页面主渲染组件。从 App.tsx 提取了 16 个 renderSettings* 函数（约 1,300 行），替代原来的内联渲染函数。通过 Zustand stores 直接访问全局状态，通过 props 接收 hook 衍生的操作函数。

## 关系
### 调用 / 引用
- `src/state/settings-store.ts` — useSettingsStore（settings, numericSettingDrafts 等）
- `src/state/ui-store.ts` — useUIStore（settingsView, openPromptEditors 等）
- `src/state/extensions-store.ts` — useExtensionsStore（skillRecords, modelHealth 等）
- `src/components/` — SettingsSectionHeading, SettingsScreen, SettingsPopoverSelect 等
- `src/components/settings/` — PermissionsSettings, ProvidersSettings, AccountsSettings, ActiNetSettings, RuntimeSettings, SkillsSettings, SkillConfigSettings, DailyCoverSettings
- `src/components/PromptEditorPanel.tsx` — 提示词编辑器
- `src/services/cloud-auth.ts` — getStoredCloudAuth, clearCloudAuth
- `src/services/daily-cover.ts` — DailyCoverSettings 类型
- `src/utils/model-utils.ts` — createProviderModelKey, modelHealthLabel
- `src/utils/app-module.ts` — getEnabledModelOptions, PROMPT_DEFAULTS 等

### 提供
- `SettingsPage` — 设置页面主组件
- `SettingsPageProps` — 组件 props 类型
- `SettingsPageNavigation` — 导航操作接口

### 被依赖
- `src/App.tsx` — 替代 renderSettingsPage() 调用

## 关键词
### 函数
- `SettingsPage` — 主组件，编排 16 个子渲染函数
- `renderMainSettings` — 主设置页渲染
- `renderTagPromptSettings` — 标签提示词设置
- `renderProviderTagPromptSettings` — 服务商标签提示词覆盖
- `renderProvidersSettings` — 服务商管理
- `renderAccountsSettings` — 账号管理
- `renderActiNetSettings` — ActiNet 账户设置
- `renderProviderDetailSettings` — 服务商详细配置
- `renderSkillsSettings` — Skills 管理
- `renderSkillConfigSettings` — Skill 配置编辑
- `renderRuntimeSettings` — 运行时设置
- `renderPermissionsSettings` — 权限设置
- `renderDailyCoverSettings` — 每日封面设置
- `renderSettingsSectionHeading`, `renderSettingsMiniSwitch`, `renderInfoPromptToggleCard`, `renderPromptEditorPanel` — 渲染辅助函数
- `formatToggleStateLabel` — 开关状态文本格式化

### 接口
- `SettingsPageProps` — 包含 resolvedDailyCover, cloudLoggedIn, setCloudAuthMode, navigation, 以及来自 useSettings/useExtensions/usePermissions 的操作函数
- `SettingsPageNavigation` — navigateSettingsView, handleSettingsBack, closeSettingsPanel, openProviderDetail
