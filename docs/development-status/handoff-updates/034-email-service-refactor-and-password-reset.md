# 034 — 邮箱服务独立化 + 密码重置 + 邮箱管理 + 健壮性增强

**日期**：2026-06-05

## 范围

在已有的邮箱验证（033）基础上，完成四大增强：邮件服务重构为独立模块、密码重置、邮箱更换管理、Admin UI 测试邮件和发送记录。

分 4 个阶段实施。

## Phase 1：邮件服务重构（独立模块）

### 新建：`cloud-server/src/email/email-service.ts`
- 从 `auth/email-service.ts` 迁移核心 SMTP 逻辑
- 统一 `sendEmail(opts)` 接口，支持 4 种邮件类型
- 内存发送记录环形缓冲（最近 20 条），供 Admin UI 查询
- `sendTestEmail(smtp, to)` — 便捷测试发送方法
- `getSendHistory()` — 查询发送记录

### 新建：`cloud-server/src/email/email-templates.ts`
- `getTemplate(type, vars)` — 集中管理所有邮件模板（纯文本中文）
- 4 种类型：`verify-email`、`password-reset`、`email-change`、`test`
- 密码重置邮件：6 位数字重置码（易于手动输入）
- 邮箱更换邮件：验证码 + 新邮箱提示

### 删除：`cloud-server/src/auth/email-service.ts`
- 功能已迁移至 `email/` 模块

### 修改：`cloud-server/src/auth/auth-service.ts`
- 导入路径改为 `../email/email-service.js`
- `sendVerificationEmail()` → `sendEmail({ type: 'verify-email', ... })` 调用

### 修改：`cloud-server/src/admin/admin-routes.ts`
- 导入 `sendTestEmail`、`getSendHistory`

## Phase 2：密码重置

### DB 迁移 v7
- `users` 表新增：`password_reset_token TEXT`、`password_reset_token_expires_at TEXT`、`pending_email TEXT`

### 类型扩展
- `types.ts`：`User` 新增 `password_reset_token`、`password_reset_token_expires_at`、`pending_email`
- `user-repo.ts`：新增 `findByPasswordResetToken()`、`updatePasswordResetToken()`、`updatePassword()`、`setPendingEmail()`、`confirmEmailChange()`

### 服务端端点
| 方法 | 路径 | 限流 | 说明 |
|------|------|------|------|
| `POST` | `/api/auth/forgot-password` | 1次/5分钟/IP | `{ email }` → 发送 6 位重置码到邮箱 |
| `POST` | `/api/auth/reset-password` | 5次/10分钟/IP | `{ token, password }` → 重置密码 |
| `POST` | `/api/auth/change-email` | API Key 认证 | `{ new_email, password }` → 发送验证码到新邮箱 |
| `POST` | `/api/auth/confirm-email-change` | 无 | `{ token }` → 确认更换邮箱 |

### 客户端
- `cloud-auth.ts`：新增 `requestCloudPasswordReset()`、`resetCloudPassword()`、`changeCloudEmail()`、`confirmCloudEmailChange()`、`fetchCloudUserInfo()`（查询邮箱验证状态）
- `StoredCloudAuth` 新增 `emailVerified?: boolean`
- `CloudAuthForm.tsx`：新增 3 个视图：
  - `forgot` — 输入邮箱请求重置
  - `forgotSent` — 显示成功提示 + 「我已有重置码」+ 「重新发送」+ 「返回登录」
  - `reset` — 输入重置码 + 新密码 + 确认密码 + 提交

## Phase 3：邮箱管理

### `ActiNetSettings.tsx`
- 挂载时通过 `/api/auth/me` 获取邮箱验证状态
- 账户信息卡片显示验证状态标签：「✓ 已验证」/「⚠ 未验证」
- 「更换邮箱」按钮 → 两步流程（输入新邮箱+密码 → 输入验证码确认）
- 确认成功后自动更新存储的邮箱信息

## Phase 4：健壮性增强

### Admin 端点
| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/admin/email/test` | `{ to }` → 发送测试邮件，返回 `{ success, message }` |
| `GET` | `/api/admin/email/status` | 返回 SMTP 配置状态 + 最近 20 条发送记录 |

### Admin UI
- `api.ts`：新增 `sendTestEmail()`、`fetchEmailStatus()`、相关接口
- `SettingsPage.tsx`：SMTP 卡片新增「发送测试邮件」按钮 + 邮箱输入框 + 结果反馈

## 设计决策

1. **6 位数字重置码**：易于用户在 App 中手动输入，1 小时过期
2. **邮箱更换需密码确认**：安全策略——防止 API Key 泄露后被用于更换绑定邮箱
3. **纯文本邮件**：保持与 033 一致，不引入 HTML 模板
4. **不引入新依赖**：继续仅使用 nodemailer
5. **发送记录内存存储**：轻量环形缓冲，不持久化到 DB，满足调试需求

## 数据流

### 密码重置
```
POST /forgot-password { email }
  → requestPasswordReset → 生成 6 位数字 token → sendEmail('password-reset')
  → 200 { message }

POST /reset-password { token, password }
  → resetPassword → 验证 token + 过期检查 → bcrypt hash → UPDATE password
  → 200 { message: "密码重置成功" }
```

### 邮箱更换
```
POST /change-email { new_email, password } (API Key)
  → requestEmailChange → 验证密码 → 存储 pending_email + token → sendEmail('email-change')
  → 200 { message }

POST /confirm-email-change { token }
  → confirmEmailChange → 验证 token → UPDATE email = pending_email
  → 200 { message, email }
```

### 邮件服务模块化
```
auth-routes → auth-service → email/email-service → nodemailer
admin-routes ──────────────→ email/email-service → nodemailer
(未来 plugin) ──────────────→ email/email-service → nodemailer
```

## 文件变更清单

### 新建（2 个）
```
cloud-server/src/email/email-service.ts
cloud-server/src/email/email-templates.ts
```

### 删除（1 个）
```
cloud-server/src/auth/email-service.ts
```

### 修改（11 个 — 服务端 7，客户端 4）
```
cloud-server/src/types.ts                       — User + pending_email
cloud-server/src/db/migrations.ts               — v7 迁移
cloud-server/src/db/repositories/user-repo.ts   — 新字段 + 5 个新方法
cloud-server/src/auth/auth-service.ts           — 导入 + 密码重置 + 邮箱更换
cloud-server/src/auth/auth-routes.ts            — 6 个新端点 + /me 增强
cloud-server/src/admin/admin-routes.ts          — 测试邮件 + 状态端点
cloud-server/admin-ui/src/api.ts                — 发送记录接口 + API 函数
cloud-server/admin-ui/src/pages/SettingsPage.tsx — 测试邮件按钮
src/services/cloud-auth.ts                      — 6 个新函数
src/components/CloudAuthForm.tsx               — 3 个新视图
src/components/settings/ActiNetSettings.tsx    — 邮箱状态 + 更换流程
```

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npx tsc --noEmit` — 主项目：零错误
- `npx vite build` — admin-ui：构建成功（390 KB JS, 8.5 KB CSS）
- `npm run build` — 主项目：仅已有 `authVersion` 未使用错误（与本次无关，033 已记录）
- `eslint` — 6 errors, 0 warnings（均为已有问题，无新增）

## 决策关卡

- 方案已提出：是（含详细工程方案，修订版）
- 用户确认已收到：是
- 确认内容：
  1. 新增独立密码重置页面（forgot/forgotSent/reset 三个视图），与登录/注册风格一致
  2. 手动输入 token（非 deep link）
  3. 4 个 Phase 全部实施

## 已知限制

- 密码重置码为 6 位数字，暴力枚举风险需要 IP 限流覆盖（已实现 5次/10分钟）
- 发送记录仅存内存，服务重启后丢失
- 邮箱更换上限未做频率限制（与重置码共用 24h token 过期）
- `tsc -b` 构建失败（`authVersion` 未使用）与本次变更无关

## 下一步

- 部署后在 Admin UI 配置 SMTP 并发送测试邮件验证
- 测试完整密码重置流程：忘记密码 → 收邮件 → 输入重置码 → 新密码登录
- 测试完整邮箱更换流程：登录 → 换邮箱 → 新邮箱收验证码 → 确认
- 可选：添加 HTML 邮件模板支持（品牌化样式）
- 可选：邮件发送持久化记录 + 统计 Dashboard
