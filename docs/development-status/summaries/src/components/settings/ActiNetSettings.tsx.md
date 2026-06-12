# `src/components/settings/ActiNetSettings.tsx`

## 功能
ActiNet 云账户详情设置页面组件。已登录时显示账户信息（用户名、邮箱、邮箱验证状态、服务器地址、API Key），支持 API Key 显示/隐藏和复制，**邮箱验证状态标记**、**邮箱更换（两步流程）**、退出登录操作。同时包含模型管理区域：列表显示、启用/禁用切换、拉取模型列表、手动添加、搜索过滤。未登录时显示登录入口按钮。

**近期变更（2026-06-12）**：高级模型开关 UI 重构。开关关闭时核心模型（快速、专家）强制启用，显示"始终启用"标签替代切换按钮，仅隐藏拉取/添加/搜索等高级功能；开关打开时恢复完整功能。使用 `getVisibleActiNetModels()` 控制显示模型列表。

组件挂载时通过 `useEffect` 自动调用 `fetchCloudUserInfo()` 获取用户完整信息（含邮箱验证状态），用于显示验证标记（✓ 已验证 / ⚠ 未验证）。邮箱更换为两步 dialog：第一步输入新邮箱和当前密码请求验证码，第二步输入验证码确认更换，成功后自动更新本地 auth 并刷新用户信息。

## 关系
### 调用 / 引用
- `src/services/cloud-auth.ts` — `StoredCloudAuth` 类型、`fetchCloudUserInfo`、`changeCloudEmail`、`confirmCloudEmailChange`、`saveCloudAuth`、`CloudUserInfo` 类型
- `src/services/actinet-models.ts` — `getEffectiveActiNetModels`, `getVisibleActiNetModels`, `saveActiNetModelPreferences`, `fetchActiNetModelsFromServer`, `mergeActiNetModels`
- `src/state/types.ts` — `ProviderModel` 类型

### 提供
- `ActiNetSettings` — React 组件（default export）

### 被依赖
- `src/App.tsx` — 在设置页面的 actinet 视图渲染

## 关键词
### 状态（邮箱相关）
- `userInfo` — `CloudUserInfo | null`，组件挂载时通过 `fetchCloudUserInfo()` 获取
- `emailChangeOpen` — 邮箱更换 dialog 是否打开
- `emailChangeStep` — `'input' | 'token'`，两步流程
- `newEmail` — 新邮箱地址输入
- `emailChangePassword` — 当前密码（身份确认）
- `emailChangeToken` — 邮箱验证码
- `emailChangeLoading` — 请求进行中
- `emailChangeError` — 错误消息
- `emailChangeMessage` — 成功提示消息

### 函数
- `ActiNetSettings` — 主组件
- `handleCopyApiKey` — 复制 API Key 到剪贴板
- `handleFetchModels` — 从服务器拉取模型列表并合并
- `toggleModel` — 切换模型启用/禁用
- `addManualModel` — 手动添加模型
- `handleRequestEmailChange` — 请求更换邮箱（第一步，验证密码后发送验证码到新邮箱）
- `handleConfirmEmailChange` — 确认更换邮箱（第二步，提交验证码，成功后更新本地 auth 并关闭 dialog）
- `resetEmailChange` — 重置邮箱更换流程的所有状态

### UI 元素
- 邮箱验证状态标记：`✓ 已验证` / `⚠ 未验证`（基于 `userInfo.email_verified`）
- 邮箱更换 dialog：两步表单，含验证码输入和取消按钮
- "更换邮箱" 按钮：位于连接信息区域
