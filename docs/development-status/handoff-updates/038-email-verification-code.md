# 038 — 邮箱验证：从点击链接改为输入验证码

**日期**：2026-06-06

## 范围

将邮箱验证流程从"点击邮件中的验证链接"改为"在 App 中输入 6 位数字验证码"。与密码重置（034）和邮箱更换（034）的验证码模式统一，提升用户体验一致性。

## 变更的代码区域

### 修改：`cloud-server/src/auth/auth-service.ts`
- `createUser()` — token 从 `randomBytes(32).toString('hex')`（64 字符）改为 `generateNumericToken()`（6 位数字）
- `resendVerificationEmail()` — 同上；移除 `verifyUrl` 构建，改为传 `vars: { token }`
- `requestPasswordReset()` — 内联 `Math.floor(100000 + Math.random() * 900000)` 改为调用共享 `generateNumericToken()`
- `requestEmailChange()` — 同上
- 新增 `generateNumericToken()` 共享函数（替代仅密码重置使用的 `generateResetToken()`）
- 移除 `generateResetToken()` 函数
- `createUser()` — 不再依赖 `ctx.config.siteUrl` 构建验证链接

### 修改：`cloud-server/src/email/email-templates.ts`
- `verify-email` 模板：从 "请点击以下链接验证..." 改为 "你的邮箱验证码是：{token}"
- `TemplateVars` 接口：移除 `verifyUrl?: string`（已无使用者）

### 修改：`cloud-server/src/auth/auth-routes.ts`
- 注册成功消息："点击验证链接" → "输入验证码"
- 验证失败消息："验证链接无效" → "验证码无效"

### 修改：`src/services/cloud-auth.ts`
- `verifyCloudEmail()` JSDoc 注释更新

### 修改：`src/components/CloudAuthForm.tsx`
- 新增 `verifyCloudEmail` 导入
- 新增状态：`verifyCode`、`verifyLoading`、`verifyError`
- 新增 `handleVerifyEmail()` — 调用 `verifyCloudEmail()` 后触发 `onAuthSuccess`
- 注册成功视图重构：新增验证码输入框 + 「验证」按钮 + 「重新发送」按钮 + 「返回登录」按钮
- `switchMode()` 重置新增状态变量

## 设计决策

1. **6 位数字验证码**：与密码重置和邮箱更换保持一致（`generateNumericToken()` 统一生成）
2. **不引入新依赖**：利用现有 `node:crypto` 的 `randomBytes` 仅用于 API Key 生成
3. **siteUrl 配置保留**：不再用于邮箱验证链接构建，但保留在 Admin UI 中供未来使用
4. **Token 过期时间不变**：仍为 24 小时
5. **验证端点签名不变**：`POST /api/auth/verify-email` 仍接受 `{ token }` JSON body

## 数据流

```
注册: POST /register → createUser → generateNumericToken() → sendEmail('verify-email', { token })
                                                                ↓
                                                          邮件含 6 位验证码
                                                                ↓
验证: 用户在 App 输入验证码 → POST /verify-email { token } → verifyEmail → email_verified=1
                                                                ↓
                                                          返回 api_key → onAuthSuccess → 主界面

重发: POST /resend-verification { email } → generateNumericToken() → sendEmail('verify-email', { token })
```

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — 主项目：零错误
- `npx vite build` — admin-ui：构建成功（413.6 KB JS, 9.0 KB CSS）
- `grep -rn verifyUrl` — 零引用，确认已完全移除

## 决策关卡

- 方案已提出：是（含详细工程方案，含变与不变的范围）
- 用户确认已收到：是
- 确认内容：
  1. 邮箱验证改为 6 位数字验证码输入方式
  2. 与密码重置/邮箱更换验证码模式统一
  3. 所有相关 API 端点签名不变

## 已知限制

- 已有未验证用户持有旧的 64 字符 hex token，无法在 6 位验证码 UI 中手动输入。可通过「重新发送」获取新验证码
- 6 位数字 token（100 万种可能）比 64 字符 hex（2^256）安全性低，但结合注册/验证限流和 token 过期机制，风险可控
- `siteUrl` 配置项保留但不再被邮箱验证流程使用（未来可能用于其他场景如密码重置 deep link）

## 下一步

- 部署后测试完整注册→收邮件→输入验证码→验证成功→自动登录流程
- 可选：为 `verify-email` 端点添加独立限流增强安全性
- 可选：评估是否移除 Admin UI 中的 `siteUrl` 配置（如无其他用途）
