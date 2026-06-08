# `src/App.tsx`

## 功能
ActiChat 应用的主 shell 组件。包含对话管理、设置面板、主页空白态渲染、消息流处理、streaming 协议解析、云服务认证集成（含启动自动登录）、首页发送过渡动画等全部核心 UI 逻辑。是应用最大、最复杂的组件。

**近期变更（2026-06-09）：**
- **思考状态短语指示器**：加载等待期间以 `ThinkingPhrase` 组件替换三点动画，按时间区间切换趣味短语+颜色渐变
- **空响应处理**：移除 `（模型未返回文本内容）` 占位文本；空正文+仅有思考内容时仅展示推理面板；真正空响应时按服务商展示对应提示（ActiNet / 其它服务商）

**近期变更（2026-06-05）：**
- **其它服务商默认关闭**：新增 `otherProvidersEnabled` 设置（默认 false），控制其它服务商在账号管理和模型选择器中的可见性；关闭时仅显示 ActiNet 模型
- **启动自动登录**：若已存储凭据（用户名+密码），启动时自动尝试登录，失败静默回退到登录表单
- **ActiNet 模型切换修复**：`selectCurrentModel` 新增 `__actinet__` 虚拟服务商分支，修复点击 ActiNet 模型无响应的问题
- **删除旧版迁移**：移除 `buildLegacyProvider` 函数，不再从旧版 settings 格式创建"默认服务商"

## 关系
### 调用 / 引用
- `src/components/NewConversationShowcase.tsx` — 主页每日封面+统计数据展示
- `src/components/CloudAuthForm.tsx` — 主页云服务登录/注册表单（条件渲染）
- `src/components/CloudLoginPage.tsx` — 独立云服务登录页面（当前未使用）
- `src/components/ThinkingPhrase.tsx` — 模型加载等待趣味短语指示器
- `src/components/settings/ActiNetSettings.tsx` — ActiNet 账户与模型管理设置页
- `src/components/settings/ProvidersSettings.tsx` — 服务商管理设置页
- `src/components/settings/DailyCoverSettings.tsx` — 每日封面设置页
- `src/components/settings/RuntimeSettings.tsx` — 运行时设置页
- `src/components/settings/SkillsSettings.tsx` — Skills 管理设置页
- `src/components/settings/SkillConfigSettings.tsx` — Skill 配置设置页
- `src/components/settings/PermissionsSettings.tsx` — 权限设置页
- `src/components/ChatHeader.tsx` — 对话顶部栏
- `src/components/ChatSummaryBar.tsx` — 对话摘要栏
- `src/components/ChatInputBox.tsx` — 消息输入框
- `src/components/HomepageSendTransition.tsx` — 首页发送过渡动画
- `src/components/SettingsScreen.tsx` — 设置页面壳
- `src/services/cloud-auth.ts` — 登录状态、connectivity 检测、自动登录、软/硬退出
- `src/services/actinet-models.ts` — ActiNet 模型启用偏好
- `src/services/daily-cover.ts` — 每日封面解析
- `src/services/homepage-highlights.ts` — 首页统计高亮
- `src/services/chat-storage/` — 对话持久化
- `src/services/skills/` — skill 运行时
- `src/state/ui-store.ts` — UI 状态管理（settings 导航等）

### 提供
- `App` — React 根组件（default export）

## 关键词
### 函数
- `App`
- `getResponseModeLabel`
- `buildHomepageModelTriggerLabel`
- `getEnabledModelOptions`
- `ensureValidCurrentModelSelection`
- `resolveProviderRequestSettings`

### 常量
- `ACTINET_PROVIDER_ID`
- `ACTINET_PROVIDER_NAME`
- `HOMEPAGE_SEND_TRANSITION_DURATION_MS`
