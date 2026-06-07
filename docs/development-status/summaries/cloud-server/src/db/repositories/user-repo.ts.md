# `cloud-server/src/db/repositories/user-repo.ts`

## 功能
用户数据仓库层。提供 User 表的 CRUD 操作，包括按多种条件查询（id / apiKey / username / email / verifyToken / passwordResetToken）、创建、更新、删除。**v10: `userFromRow` 解析 `email_verified`、`email_verify_token`、`email_verify_token_expires_at`；`create()` INSERT 包含邮箱验证列；新增 `findByVerifyToken()`、`verifyUserEmail()`、`updateVerifyToken()`。v11: 新增密码重置和邮箱更换支持 — `userFromRow` 解析 `password_reset_token`、`password_reset_token_expires_at`、`pending_email`；`create()` INSERT 新增 3 列；新增 `findByPasswordResetToken()`、`updatePasswordResetToken()`、`updatePassword()`、`setPendingEmail()`、`confirmEmailChange()`。**

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts` — `User`
- `cloud-server/src/db/database.ts` — `DbGetter`, `autoSave`
- `cloud-server/src/db/helpers.ts` — `queryOne`, `queryAll`

### 提供
- `UserRepo` 类 — 实例方法：
  - `findById(id)` — 按 ID 查找
  - `findByApiKey(apiKey)` — 按 API Key 查找（仅启用的用户）
  - `findByUsername(username)` — 按用户名查找
  - `findByEmail(email)` — 按邮箱查找
  - `findByVerifyToken(token)` — 按邮箱验证 token 查找
  - `findByPasswordResetToken(token)` — 按密码重置 token 查找
  - `listAll()` — 列出所有用户
  - `create(user)` — 创建用户（14 列包括 password_reset_token/password_reset_token_expires_at/pending_email）
  - `update(id, updates)` — 更新速率限制和启用状态
  - `verifyUserEmail(id)` — 标记邮箱已验证
  - `updateVerifyToken(id, token, expiresAt)` — 更新验证 token
  - `updatePasswordResetToken(id, token, expiresAt)` — 存储密码重置 token 和过期时间
  - `updatePassword(id, passwordHash)` — 更新密码哈希并清空重置 token
  - `setPendingEmail(id, pendingEmail, verifyToken, expiresAt)` — 存储待定邮箱和验证码
  - `confirmEmailChange(id)` — 将 pending_email 写入 email 并清空待定字段
  - `delete(id)` — 删除用户
  - `overwritePendingUser(id, data)` — **覆盖未验证用户（新用户名/密码/哈希/API Key/验证 token/过期时间）**
  - `deleteExpiredUnverified(retentionHours)` — **删除所有超过保留时长的未验证账户，返回删除数量**

### 被依赖
- `cloud-server/src/auth/auth-service.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/admin/admin-routes.ts`
- `cloud-server/src/app-context.ts`

## 关键词
### 类
- `UserRepo`

### 函数
- `userFromRow`

### 方法
- `confirmEmailChange`
- `create`
- `delete`
- `findByApiKey`
- `findByEmail`
- `findById`
- `findByPasswordResetToken`
- `findByUsername`
- `findByVerifyToken`
- `listAll`
- `setPendingEmail`
- `update`
- `updatePassword`
- `updatePasswordResetToken`
- `updateVerifyToken`
- `verifyUserEmail`
