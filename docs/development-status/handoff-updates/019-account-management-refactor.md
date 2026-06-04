# 019 — 服务商管理重构为账号管理（ActiNet + 其它服务商）

**Date**: 2026-06-03

## 背景

将设置中的"服务商管理"重构为"账号管理"概念，下设两个栏目：ActiNet（云服务账户管理）和「其它服务商」（原有服务商管理页面）。新增一个中间导航层级。

## 改动

### 新增文件
- `src/components/settings/AccountsSettings.tsx` — 账号管理中间页，渲染 ActiNet 和「其他服务商」两个入口卡片
- `src/components/settings/ActiNetSettings.tsx` — ActiNet 账户详情页，支持登录/退出、账户信息展示、API Key 显示/隐藏/复制
- `docs/development-status/summaries/src/components/settings/AccountsSettings.tsx.md` — 摘要
- `docs/development-status/summaries/src/components/settings/ActiNetSettings.tsx.md` — 摘要

### 修改文件
- `src/state/types.ts` — `SettingsView` 联合类型新增 `'accounts'` 和 `'actinet'`
- `src/App.tsx` — 内部 `SettingsView` 类型新增两个值；`settingsScrollByViewRef` 新增条目；主设置页「Provider」区块改为「Account/账号管理」入口链接到 `'accounts'`；新增 `renderAccountsSettings` 和 `renderActiNetSettings` 渲染函数；`renderSettingsPage` switch 新增 cases；`handleSettingsBack` 新增 `'providers'`/`'actinet'` → `'accounts'` 返回逻辑；新增 `getStoredCloudAuth` 和 `clearCloudAuth` 导入
- `src/components/settings/ProvidersSettings.tsx` — 页面标题从"服务商管理"改为"其它服务商"

## 导航层级

```
Settings main
  └── 账号管理 (accounts)          ← 新增
        ├── ActiNet (actinet)       ← 新增
        └── 其它服务商 (providers)  ← 原有
```

## 设计决策

- ActiNet 登录入口保留在 ProvidersSettings 中作为快捷方式（条件显示：未登录且有服务商时）
- ActiNetSettings 中的登出操作会调用 `clearCloudAuth()` 并导航回账号管理页
- API Key 采用显示/隐藏切换 + 一键复制模式，复制后 2 秒显示"已复制"反馈
- `AccountsSettings` 不直接包含登录按钮 — 用户需进入 ActiNet 页面进行操作

## 未解决的问题

- 无
