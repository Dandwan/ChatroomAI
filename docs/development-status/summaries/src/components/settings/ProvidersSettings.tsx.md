# `src/components/settings/ProvidersSettings.tsx`

## 功能
服务商（Provider）管理设置页面组件。显示已配置服务商列表，提供添加、编辑、删除操作。当用户配置了服务商但尚未登录 ActiNet 云服务时，显示「ActiNet 登录」入口按钮。

## 关系
### 调用 / 引用
- `src/state/types.ts` — `AppSettings` 类型

### 提供
- `ProvidersSettings` — React 组件（default export）

### 被依赖
- `src/App.tsx` — 在设置页面的 providers 视图渲染

## 关键词
### 函数
- `ProvidersSettings`
