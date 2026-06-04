# `src/components/settings/ActiNetSettings.tsx`

## 功能
ActiNet 云账户详情设置页面组件。已登录时显示账户信息（用户名、邮箱、服务器地址、API Key），支持 API Key 显示/隐藏和复制，提供退出登录操作。同时包含模型管理区域：列表显示、启用/禁用切换、拉取模型列表、手动添加、搜索过滤。未登录时显示登录入口按钮。

## 关系
### 调用 / 引用
- `src/services/cloud-auth.ts` — `StoredCloudAuth` 类型
- `src/services/actinet-models.ts` — 模型管理函数
- `src/state/types.ts` — `ProviderModel` 类型

### 提供
- `ActiNetSettings` — React 组件（default export）

### 被依赖
- `src/App.tsx` — 在设置页面的 actinet 视图渲染

## 关键词
### 函数
- `ActiNetSettings`
- `handleCopyApiKey`
- `handleFetchModels`
- `toggleModel`
- `addManualModel`
