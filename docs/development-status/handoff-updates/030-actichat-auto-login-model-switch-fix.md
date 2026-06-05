# 030 — ActiChat 启动自动登录 + ActiNet 模型切换修复 + 删除旧版迁移

**日期**：2026-06-05

## 范围

三个变更：
1. ActiChat 启动时自动登录：若已存储凭据（用户名+密码），启动时自动尝试登录
2. 修复 ActiNet 模型切换：点击"快速""专家"模型无法切换的 bug
3. 删除 `buildLegacyProvider` 旧版迁移逻辑

## 变更的代码区域

### 修改：`src/services/cloud-auth.ts`

**自动登录支持：**
- 新增 `CREDENTIALS_KEY`（`actichat_cloud_credentials`）独立存储凭据
- 新增 `StoredCloudCredentials` 接口（serverUrl、username、email、password）
- 新增 `encodePassword`/`decodePassword` 辅助函数（Base64 混淆）
- 新增 `saveCloudCredentials`、`getStoredCloudCredentials`、`clearCloudCredentials` 内部函数
- 新增导出函数 `hasStoredCredentials()` — 判断是否有可用于自动登录的凭据
- 新增导出函数 `tryAutoLogin()` — 用已存凭据尝试登录，成功返回 true，失败静默返回 false
- 修改 `cloudLogin()` / `cloudRegister()` — 成功后同时保存凭据
- 修改 `clearCloudAuth()` — 硬退出时同时清除凭据
- `deactivateCloudAuth()` 保持不变（软退出保留凭据，用于后续自动登录）

**设计决策：**
- 凭据与 auth token 分离存储（独立 localStorage key），职责清晰
- 密码使用 Base64 编码（`btoa`/`atob`）混淆，非明文存储
- 自动登录失败静默处理，不弹通知（用户确认选项 a）

### 修改：`src/App.tsx`

**1. 启动自动登录（~2250 行）**
- 导入 `tryAutoLogin`、`hasStoredCredentials`
- 重构启动 `useEffect`：
  - 已登录 → `verifyCloudAuth()`（不变）
  - 未登录但有凭据 → `tryAutoLogin()`，成功则重置 `cloudAuthMode` 触发 UI 刷新
  - 无凭据 → 静默（主页自然显示 CloudAuthForm）

**2. ActiNet 模型切换修复（~3360 行）**
- 根因：`selectCurrentModel` 仅在 `settings.providers` 数组中查找 provider，ActiNet（`__actinet__`）是虚拟服务商不在该数组中，导致切换静默失败
- 修复：新增 `ACTINET_PROVIDER_ID` 分支，从 `getEffectiveActiNetModels()` 验证模型有效性后直接更新 `currentProviderId`/`currentModel`

**3. 删除旧版迁移（~1742 行）**
- 删除 `buildLegacyProvider` 函数（33 行）— 旧版 settings 格式 → "默认服务商"的迁移逻辑
- `loadSettings` 中 `providers` 直接使用 `parsedProviders`
- `currentProviderId` 回退值移除 `legacyProvider?.id` 引用，直接回退到 `DEFAULT_SETTINGS.currentProviderId`

### 更新：代码摘要
- `summaries/src/services/cloud-auth.ts.md` — 新增凭据存储和自动登录函数说明
- `summaries/src/App.tsx.md` — 新增近期变更记录（自动登录、模型切换修复、删除旧版迁移）

## 数据流

### 自动登录
```
启动
├─ isCloudLoggedIn()? — token + apiKey 有效?
│  ├─ Y → verifyCloudAuth() — 验证 token
│  │      ├─ 有效 → 正常
│  │      └─ 无效 → deactivateCloudAuth()（保留凭据）
│  └─ N → hasStoredCredentials()? — 有用户名+密码?
│         ├─ Y → tryAutoLogin()
│         │      ├─ 成功 → 刷新 UI，进入已登录状态
│         │      └─ 失败 → 静默，主页显示 CloudAuthForm
│         └─ N → 静默，主页显示 CloudAuthForm
```

### ActiNet 模型切换
```
用户点击"快速" → selectCurrentModel('__actinet__', '快速')
  → getEffectiveActiNetModels() 验证"快速"存在且 enabled
  → 更新 settings.currentProviderId='__actinet__', currentModel='快速'
  → UI 更新：选中状态 + 后续请求路由到 ActiNet
```

## 验证

- `npx tsc --noEmit` — 零错误
- `npm run lint` — 6 errors / 50 warnings，全部为已有问题，无新增
- `npm run build` — 构建成功（748.91 KB JS）

## 决策关卡

- 方案已提出：是（含密码混淆策略、凭据分离存储、静默失败处理）
- 用户确认已收到：是
- 用户决策：
  1. 密码需要混淆处理（Base64）
  2. 确认删除 buildLegacyProvider
  3. 自动登录失败静默处理

## 已知限制

- 密码使用 Base64 混淆而非真正加密，在 Capacitor/WebView 环境下是务实折中
- 自动登录仅检查凭据存在性，不验证密码复杂度
- 旧版 settings 格式用户升级后将丢失自动迁移的"默认服务商"（开发阶段影响极小）
- `selectCurrentModel` 的 ActiNet 分支与普通 provider 分支有少量重复逻辑（刻意保持清晰而非过早抽象）

## 下一步

- 在 Android 设备上验证：清除数据 → 登录 → 退出 → 重启 app → 应自动登录
- 验证模型切换：登录 ActiNet → 在模型选择器切换"快速"/"专家" → 发送消息确认模型生效
- 可选：后续将 Base64 混淆替换为 Android Keystore 加密
