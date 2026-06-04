# `src/components/settings/AccountsSettings.tsx`

## 功能
账号管理中间页面组件。渲染两个入口卡片：ActiNet 云服务入口和「其他服务商」入口，分别导航到对应的子页面。

## 关系
### 调用 / 引用
- `src/state/types.ts` — `AppSettings` 类型
- `src/services/cloud-auth.ts` — `StoredCloudAuth` 类型

### 提供
- `AccountsSettings` — React 组件（default export）

### 被依赖
- `src/App.tsx` — 在设置页面的 accounts 视图渲染

## 关键词
### 函数
- `AccountsSettings`
