# 017 — 主页集成云服务登录与注册

**日期**：2026-06-03

## 范围

将 ActiNet 云服务登录和注册功能直接集成到应用主页，替换原有的每日封面+统计展示。当用户无运营商且未登录时，主页显示登录/注册表单；登录或添加运营商后恢复原主页。同时在运营商管理页面添加 ActiNet 登录入口。

## 变更的代码区域

### 修改：`src/services/cloud-auth.ts`
- 新增 `cloudRegister(serverUrl, username, email, password)` — 调用 `POST /api/auth/register`，注册成功后自动持久化 token/apiKey 到 localStorage（与 login 行为一致）

### 新建：`src/components/CloudAuthForm.tsx`
- 嵌入主页的登录/注册表单组件
- 支持登录/注册双模式切换
- 未配置服务器地址时自动显示地址输入框
- UI 复用主页 editorial design 体系（`cover-empty-state` 结构、字体栈、颜色）

### 修改：`src/App.tsx`
- 导入 `CloudAuthForm`、`isCloudLoggedIn`
- 新增 `cloudAuthMode` 状态（`'none'` / `'login'` / `'register'`）
- 新增派生变量：`cloudLoggedIn`、`hasProviders`、`showCloudAuthOnHomepage`
- 主页空白态条件渲染：未登录+无运营商时显示 `CloudAuthForm`，否则显示 `NewConversationShowcase`
- `renderProvidersSettings` 传递 `isCloudLoggedIn` 和 `onCloudLogin` props

### 修改：`src/components/settings/ProvidersSettings.tsx`
- 新增 props：`isCloudLoggedIn`、`onCloudLogin`
- 未登录且有运营商时显示「ActiNet 登录」按钮，点击后关闭设置面板并在主页显示登录表单

### 修改：`src/styles/app-editorial-redesign.css`
- 新增 `.cover-auth-form` 系列样式（表单、输入框、标签、错误提示、按钮）
- 新增 `.cloud-provider-login-btn` 样式

### 新建：代码摘要（5 个文件）
- `summaries/src/services/cloud-auth.ts.md`
- `summaries/src/components/CloudAuthForm.tsx.md`
- `summaries/src/components/settings/ProvidersSettings.tsx.md`
- `summaries/src/styles/app-editorial-redesign.css.md`
- `summaries/src/App.tsx.md`

## 主页渲染决策逻辑

```
isHomepageEmptyState = true:
  if (!cloudLoggedIn && !hasProviders) || cloudAuthMode !== 'none':
    显示 CloudAuthForm（风景背景保留）
  else:
    显示 NewConversationShowcase（每日封面+统计）
```

## 验证

- `npx tsc --noEmit` — 零错误
- `npm run lint` — 无新增错误（CloudAuthForm 初始 lint 错误已修复）
- `npm run build` — 构建成功

## 决策关卡

- 方案已提出：是（完整工程方案，含组件交互、CSS 体系、状态管理）
- 用户确认已收到：是

## 已知限制 / 跳过的检查

- 未在 Android 设备/模拟器上验证 UI 表现
- `cloudRegister` 未添加客户端密码复杂度校验（与服务器端策略一致——用户此前明确要求密码规则保持自由）
- 服务器地址输入框仅在未保存地址时显示，不支持登录后更换服务器

## 待解决问题 / 风险

- 如果用户登录后又退出（`clearCloudAuth`），需要手动刷新状态或在 App 中监听 storage 变化才能让主页重新显示登录表单——当前实现依赖 React 重新渲染时调用 `isCloudLoggedIn()`
- `CloudLoginPage.tsx` 组件仍存在但已无引用入口，后续可考虑移除或重构为设置页内的独立登录面板

## 下一步

- 在 Android 模拟器/真机上验证登录/注册 UI 的视觉表现和交互流程
- 如需退出登录功能，在设置页面添加退出按钮并确认识别状态同步
- 考虑是否移除未使用的 `CloudLoginPage.tsx`
