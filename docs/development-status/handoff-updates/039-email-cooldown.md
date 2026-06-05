# 039 — 邮箱发送冷却时间

**日期**：2026-06-06

## 范围

为 cloud-server 新增邮箱发送冷却机制。同一邮箱地址在可配置的时间间隔内（默认 120 秒）只能发送一封邮件。冷却设置可通过 Admin UI 全局设置页面配置（0 = 无冷却）。

## 变更的代码区域

### 修改：`cloud-server/src/config.ts`
- `ServerConfig` 新增 `emailCooldownSeconds: number`（默认 120）
- 环境变量 `CLOUD_SERVER_EMAIL_COOLDOWN_SECONDS` 可覆盖
- `reloadConfigFromFile()` 支持热重载
- config.json 持久化支持

### 修改：`cloud-server/src/email/email-service.ts`
- 新增 `Map<string, number>` 内存冷却记录（email → 上次成功发送时间戳 ms）
- 新增 `getEmailCooldownRemaining(email, cooldownSeconds)` — 查询冷却剩余秒数
- `sendEmail()` 返回类型从 `boolean` 改为 `SendEmailResult { success: boolean; cooldownRemaining?: number }`
- 发送前检查冷却：若在冷却期内返回 `{ success: false, cooldownRemaining }` 并记录日志
- 发送成功后才更新冷却时间戳（失败的发送不触发冷却）
- `sendTestEmail()` 不受冷却限制（管理员测试用）
- 新增 `SendEmailResult` 接口导出

### 修改：`cloud-server/src/auth/auth-service.ts`
- `createUser()` — 返回类型新增 `cooldownRemaining?: number`，传入 `cooldownSeconds` 配置
- `resendVerificationEmail()` — 传入 `cooldownSeconds`，冷却时记录日志但不暴露给调用方（安全模糊响应）
- `requestPasswordReset()` — 同上，安全模糊
- `requestEmailChange()` — 返回类型新增 `'cooldown'`，传入 `cooldownSeconds`，冷却时返回 cooldown 状态

### 修改：`cloud-server/src/auth/auth-routes.ts`
- 注册端点：冷却阻塞时返回 `"邮件发送过于频繁，请在 X 秒后再试"`
- 重发验证端点：保持安全模糊响应（不暴露邮箱是否存在或冷却状态）
- 密码重置端点：保持安全模糊响应
- 邮箱更换端点：冷却时返回 `429 COOLDOWN`

### 修改：`cloud-server/src/admin/admin-routes.ts`
- `GET /api/admin/settings` — 响应新增 `emailCooldownSeconds`
- `PUT /api/admin/settings` — 接受并验证 `emailCooldownSeconds`（非负整数），持久化到 `config.json`

### 修改：`cloud-server/admin-ui/src/api.ts`
- `ServerSettings` 接口新增 `emailCooldownSeconds: number`
- `updateSettings()` 参数新增 `emailCooldownSeconds?: number`

### 修改：`cloud-server/admin-ui/src/pages/SettingsPage.tsx`
- 新增 `emailCooldown` 状态（默认 120）
- 邮件服务卡片新增「发送冷却时间（秒）」输入框（最小值 0，0 = 无冷却）
- `load()` 和 `handleSave()` 适配新字段

## 设计决策

1. **内存 Map 冷却追踪**：与发送历史记录一致（内存环形缓冲），不引入持久化复杂度。服务重启后冷却记录丢失，可接受。
2. **冷却在 `sendEmail` 内部检查**：集中管理，避免每个调用点重复实现。通过 `SendEmailResult.cooldownRemaining` 向上传递状态。
3. **安全模糊响应**：密码重置（`forgot-password`）和重发验证（`resend-verification`）端点不暴露冷却状态，防止攻击者通过冷却错误信息枚举注册邮箱。
4. **已认证端点可返回冷却信息**：注册（自身操作）和邮箱更换（需 API Key 认证）可返回明确的冷却提示，提升用户体验。
5. **测试邮件豁免冷却**：`type === 'test'` 时跳过冷却检查，管理员可连续发送测试邮件验证配置。
6. **默认 120 秒**：平衡防滥用与用户体验，Admin UI 可配置为 0（完全关闭冷却）。

## 数据流

```
注册: POST /register → createUser → sendEmail({ cooldownSeconds: 120 })
  ├─ 冷却期内 → { success: false, cooldownRemaining: 85 }
  │             → 201 { message: "请等待 85 秒后再试" }
  └─ 冷却期外 → 发送成功 → lastSendTime.set(email, now)
                → 201 { message: "验证邮件已发送" }

密码重置: POST /forgot-password → requestPasswordReset → sendEmail(...)
  ├─ 冷却期内 → 记录日志，仍返回 "如果已注册..."（安全模糊）
  └─ 冷却期外 → 发送成功

重发验证: POST /resend-verification → resendVerificationEmail → sendEmail(...)
  ├─ 冷却期内 → 记录日志，仍返回 "如果已注册..."（安全模糊）
  └─ 冷却期外 → 发送成功

邮箱更换: POST /change-email (API Key) → requestEmailChange → sendEmail(...)
  ├─ 冷却期内 → 返回 'cooldown' → 429 { code: 'COOLDOWN' }
  └─ 冷却期外 → 发送成功 → 200 { message: "验证码已发送" }
```

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npx tsc --noEmit` — 主项目：零错误
- `npm run build` — admin-ui：构建成功（413.6 KB JS, 9.0 KB CSS）

## 决策关卡

- 方案已提出：是（含详细工程方案，含替代方案对比）
- 用户确认已收到：是
- 确认内容：
  1. 默认 120 秒冷却，Admin UI 可配置（0 = 无冷却）
  2. 安全敏感端点保持模糊响应
  3. `sendEmail` 返回类型改为结构化对象

## 已知限制

- 冷却记录仅存内存，服务重启后丢失
- 多实例部署时冷却记录不共享（每个实例独立追踪）
- 不区分邮件类型冷却（验证邮件、密码重置、邮箱更换共用同一冷却窗口）

## 下一步

- 部署后在 Admin UI 验证冷却配置可正常保存和生效
- 测试同一邮箱连续注册/重置密码的冷却行为
- 可选：未来考虑持久化冷却记录（Redis 或 SQLite）以支持多实例部署
