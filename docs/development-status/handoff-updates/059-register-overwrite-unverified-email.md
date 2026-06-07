# 059 — 注册覆盖未验证邮箱 + 待验证账户自动清理

**日期**：2026-06-08

## 范围

更新用户注册逻辑链路：

1. 用户提交注册表单 → 创建待验证账户（不自动登录）
2. 邮箱验证前，同一邮箱可反复提交注册 → 每次覆盖上一个待验证记录（新用户名/密码/验证码/24h 窗口重置）
3. 邮箱验证后 → 正式账户，同一邮箱不可再次注册
4. 待验证账户保留时长可配置（Admin UI，默认 24h，1-720），过期自动清理

## 变更的代码区域

### 修改：`cloud-server/src/config.ts`
- `ServerConfig` 接口新增 `pendingAccountRetentionHours: number`（默认 24）
- `loadConfig()` — 环境变量 `CLOUD_SERVER_PENDING_ACCOUNT_RETENTION_HOURS` 覆盖，范围校验 1-720
- `reloadConfigFromFile()` — 支持热重载

### 修改：`cloud-server/src/db/repositories/user-repo.ts`
- 新增 `overwritePendingUser(id, data)` — 覆盖未验证用户所有字段（username, email, password_hash, api_key, email_verify_token, email_verify_token_expires_at）
- 新增 `deleteExpiredUnverified(retentionHours): number` — 批量删除超过保留时长的未验证账户，返回删除数量

### 修改：`cloud-server/src/auth/auth-service.ts`
- `VERIFY_TOKEN_EXPIRY_MS` 硬编码常量移除，改为从 `ctx.config.pendingAccountRetentionHours` 动态计算
- `createUser()` 核心逻辑重写：
  - 查邮箱 → 已存在且已验证 → 拒绝（返回 null）
  - 查邮箱 → 已存在但未验证 → **覆盖**该记录，返回 `overwritten: true`
  - 查邮箱 → 不存在 → 查用户名 → 存在则拒绝，不存在则新建
- `resendVerificationEmail()` — 使用动态 token 过期时间
- `requestEmailChange()` — 使用动态 token 过期时间
- 新增 `cleanupExpiredPendingAccounts(ctx): number` — 删除所有过期未验证账户

### 修改：`cloud-server/src/auth/auth-routes.ts`
- `POST /api/auth/register` — 响应消息区分新注册/覆盖注册，动态显示可配置的保留时长

### 修改：`cloud-server/src/admin/admin-routes.ts`
- `GET /api/admin/settings` — 响应新增 `pendingAccountRetentionHours`
- `PUT /api/admin/settings` — 接受并验证 `pendingAccountRetentionHours`（整数，1-720），持久化到 `config.json`

### 修改：`cloud-server/admin-ui/src/api.ts`
- `ServerSettings` 接口新增 `pendingAccountRetentionHours: number`
- `updateSettings()` 参数新增 `pendingAccountRetentionHours?: number`

### 修改：`cloud-server/admin-ui/src/pages/SettingsPage.tsx`
- 新增状态 `pendingAccountRetention`（默认 24）
- 新增 UI 输入框：「待验证账户保留时长（小时）」`<input type="number" min={1} max={720} />`
- `load()` 和 `handleSave()` 适配新字段

### 新建：摘要文件
- `docs/development-status/summaries/cloud-server/admin-ui/src/pages/SettingsPage.tsx.md`

## 不涉及变更

- 客户端 `src/services/cloud-auth.ts` — API 响应结构向后兼容，无需修改
- 客户端 `src/components/CloudAuthForm.tsx` — 注册表单/验证码输入界面无需修改
- `/verify-email`、`/login`、`/resend-verification` 等端点签名和行为不变
- 密码重置、邮箱更换流程不变
- DB 结构无需迁移（已有 `created_at` 和 `email_verified` 列）

## 设计决策

1. **覆盖而非删除重建**：保持 user ID 不变，仅 UPDATE 字段。不产生孤儿引用。
2. **用户名始终唯一**：无论是否已验证，用户名被占用后不能重复使用。
3. **清理策略 = 启动 + 惰性**：每次 `createUser()` 前对命中邮箱做过期检查；同时提供 `cleanupExpiredPendingAccounts()` 供启动时调用。无需定时器。
4. **API Key 每次覆盖重新生成**：旧 Key 从未分发（验证后才返回），无安全隐患。
5. **Admin 可配置范围 1-720**：最灵活地支持从 1 小时到 30 天的保留策略。

## 数据流

```
注册（新邮箱）:
  POST /register → createUser → 无人占用 → INSERT 新待验证记录
  → 201 { message: "注册成功！验证邮件已发送至 xxx（N 小时内有效）", overwritten: false }

注册（覆盖待验证邮箱）:
  POST /register → createUser → email 已有未验证 → OVERWRITE（新用户名/密码/验证码/24h窗口重置）
  → 201 { message: "注册信息已更新！验证邮件已重新发送至 xxx（N 小时内有效）", overwritten: true }

注册（已验证邮箱）:
  POST /register → createUser → email 已有已验证 → null
  → 409 { error: "用户名或邮箱已存在" }

清理：
  cleanupExpiredPendingAccounts(ctx) → DELETE FROM users WHERE email_verified = 0 AND created_at < datetime('now', '-{N} hours')
```

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npx tsc --noEmit` — 主项目：零错误
- `npm run build` — admin-ui：构建成功（418.93 KB JS, 9.46 KB CSS）

## 决策关卡

- 方案已提出：是（含详细工程方案，含变更范围和不涉及变更的明确边界）
- 用户确认已收到：是
- 确认内容：
  1. 同一未验证邮箱可反复注册，每次覆盖上一个记录
  2. 已验证邮箱不可再次注册
  3. 待验证账户保留时长在 Admin UI 可配置（默认 24h，1-720）
  4. 用户名始终唯一（不论验证状态）

## 已知限制

- 过期清理仅在启动时批量运行 + 创建用户时惰性运行，无定时器轮询。过期后到下次注册前可能有短暂延迟。
- 多实例部署时清理记录不共享（各实例独立追踪）。
- `cleanupExpiredPendingAccounts` 尚未集成到 `app.ts` 启动流程中（需在后续提交中调用）。

## 下一步

- 在 `app.ts` 或 `index.ts` 启动时调用 `cleanupExpiredPendingAccounts(ctx)`
- 部署后在 Admin UI 验证 `pendingAccountRetentionHours` 配置正常保存和生效
- 测试完整流程：注册 → 重新注册覆盖 → 验证邮箱 → 尝试用同一邮箱再次注册（应拒绝）
- 可选：添加定时清理任务（如每小时）以减少惰性清理延迟
