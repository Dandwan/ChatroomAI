# `src/services/actinet-models.ts`

## 功能
ActiNet 云服务模型管理服务层。提供默认模型常量（快速、专家）、本地模型启用偏好持久化（localStorage）、从 cloud-server 拉取可用模型列表、远程与本地模型列表合并等功能。

## 关系
### 调用 / 引用
- `src/state/types.ts` — `ProviderModel` 类型

### 提供
- `DEFAULT_ACTINET_MODELS` — 默认模型常量（快速、专家）
- `getStoredActiNetModels()` — 读取本地存储的模型启用偏好
- `saveActiNetModelPreferences(models)` — 保存模型启用偏好
- `getEffectiveActiNetModels()` — 获取实际生效的模型列表（用户配置优先，否则用默认）
- `fetchActiNetModelsFromServer(serverUrl, apiKey)` — 从 cloud-server 拉取模型列表
- `mergeActiNetModels(remoteModels, storedModels)` — 合并远程列表与本地偏好

### 被依赖
- `src/App.tsx` — 使用 `getEffectiveActiNetModels`
- `src/components/settings/ActiNetSettings.tsx` — 使用模型管理函数

## 关键词
### 常量
- `DEFAULT_ACTINET_MODELS`

### 函数
- `getStoredActiNetModels`
- `saveActiNetModelPreferences`
- `getEffectiveActiNetModels`
- `fetchActiNetModelsFromServer`
- `mergeActiNetModels`
