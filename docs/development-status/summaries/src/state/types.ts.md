# `src/state/types.ts`

## 功能
ActiChat 应用的共享类型定义中心。包含 `AppSettings`、`ProviderConfig`、`ProviderModel`、`Conversation`、UI 状态等全部核心类型的接口定义和常量。作为类型枢纽避免循环导入，供 App.tsx 和其他组件引用。

## 关系
### 提供
- `AppSettings` — 应用设置类型（含新增 `actiNetModels: ProviderModel[]`）
- `ProviderModel` — 模型配置（id + enabled）
- `ProviderConfig` — 供应商配置（含模型列表）
- `EnabledModelOption` — 聊天模型选择器选项
- `SettingsView` — 设置页面视图联合类型
- `ThemeMode`、`Conversation`、`AppPermissions` 等多种类型和常量

### 被依赖
- `src/App.tsx` — 使用全部类型
- `src/services/actinet-models.ts` — 使用 `ProviderModel`
- `src/components/settings/*` — 使用设置相关类型
- `src/state/*` — 使用共享类型

## 关键词
### 接口
- `ProviderModel`
- `ProviderConfig`
- `AppSettings`
- `EnabledModelOption`
- `Conversation`
- `AppPermissions`

### 常量
- `DEFAULT_CHAT_BLUR_PX`
- `SETTINGS_STORAGE_KEY`
