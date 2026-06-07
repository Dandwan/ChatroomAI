# 060 — 用户管理分组 + 冷却时保留旧验证码

**日期**：2026-06-08
**类型**：新增功能（New Feature）

## 范围

两组独立但相关的变更：

1. **Admin 用户管理页面分组管理**：用户列表可按状态分组筛选（全部/已启用/未启用/未验证），未验证用户显示专用标签而非启用/禁用按钮。
2. **邮件冷却期间保留旧验证码**：修复 `resendVerificationEmail()` 和 `createUser()` 覆盖路径中「先生成新 token 写入 DB，再尝试发送邮件」的顺序问题。当冷却阻塞邮件发送时，旧 token 保持不变，上一封邮件中的验证码仍然有效。

## 变更的代码区域

### 修改：`cloud-server/src/admin/admin-routes.ts`（+1 行）

- `GET /api/admin/users` 响应映射新增 `email_verified: u.email_verified` 字段

### 修改：`cloud-server/admin-ui/src/api.ts`（+1 行）

- `UserData` 接口新增 `email_verified: number` 字段

### 修改：`cloud-server/admin-ui/src/pages/UsersPage.tsx`（~55 行重构）

- 新增 `FilterKey` 类型和 `FilterTab[]` 常量
- 新增 `filterUsers()` 客户端筛选函数
- 新增 `filter` 状态（默认 `'all'`）
- 新增 `counts` memo（各分组用户数）
- 新增 `filtered` memo（筛选后的用户列表）
- 新增分组标签栏 UI（4 个标签，激活态蓝色，含 count badge）
- 状态列：未验证用户（`email_verified === 0`）显示「未验证」徽章，已验证用户显示启用/禁用切换按钮
- 表格 body 从 `users.map` 改为 `filtered.map`

### 修改：`cloud-server/admin-ui/src/styles/admin.css`（~35 行新增）

- 新增 `.admin-filter-tabs` — 分组标签栏（flex row, gap, wrap）
- 新增 `.admin-filter-tab` — 标签按钮（padding, border-radius, transitions）
- 新增 `.admin-filter-tab.active` — 激活态（accent 蓝色背景白色文字）
- 新增 `.admin-filter-count` — 计数文字（半透明，tabular-nums）
- 新增 `.admin-badge-unverified` — 未验证徽章（warn 色系）

### 修改：`cloud-server/src/auth/auth-service.ts`（~25 行重构）

- `resendVerificationEmail()`：DB `updateVerifyToken` 移到 `sendEmail` **成功之后**，冷却阻塞时旧 token 保持不变
- `createUser()` 覆盖路径：改为先发邮件，成功则 `overwritePendingUser`（含新 token），失败则 `overwritePendingUserKeepToken`（保留旧 token）

### 修改：`cloud-server/src/db/repositories/user-repo.ts`（+22 行）

- 新增 `overwritePendingUserKeepToken(id, data)` — 覆盖未验证用户基本信息（username/email/password_hash/api_key），保留现有 `email_verify_token` 和 `email_verify_token_expires_at`

### 新建：摘要文件

- `docs/development-status/summaries/cloud-server/admin-ui/src/pages/UsersPage.tsx.md`

### 更新：代码摘要（4 个）

- `admin-routes.ts.md` — v17 `email_verified` 字段
- `api.ts.md` — v15 `UserData.email_verified`
- `auth-service.ts.md` — v14 冷却保留旧 token
- `user-repo.ts.md` — 新增 `overwritePendingUserKeepToken`

## 设计决策

1. **前端分组筛选**：用户量级小（预期 <= 几百），客户端 memory filter 零延迟且避免后端改 API 签名。每组用 `useMemo` 预计算 count 避免重复遍历。
2. **未验证用户不显示启用/禁用按钮**：未验证用户不参与代理转发（不可登录，无 API 调用能力），启用/禁用对其无意义。改为静态「未验证」标签。
3. **分组互斥**：已启用/未启用仅含已验证用户，未验证独立成组。覆盖所有用户且不重叠。
4. **先发邮件再写 DB**：`resendVerificationEmail()` 和 `createUser()` 覆盖路径都改为「先调 `sendEmail`，成功后才更新 DB token」。这是唯一符合用户期望的修正。
5. **`overwritePendingUserKeepToken` 独立方法**：新增专用方法而非给 `overwritePendingUser` 加条件参数，两种场景语义不同（保留 vs 替换 token），独立方法更清晰且不会误用。

## 验证

- [x] `npx tsc --noEmit` — cloud-server：零错误
- [x] `npx tsc --noEmit` — admin-ui：零错误
- [x] `npm run build` — admin-ui：构建成功（419.98 KB JS, 10.13 KB CSS）
- [ ] 部署后验证：用户管理页面分组标签切换 + count 正确
- [ ] 部署后验证：冷却时间内重发验证邮件 → 旧验证码仍可验证
- [ ] 部署后验证：冷却时间内重复注册覆盖 → 旧验证码仍可验证
- [ ] 部署后验证：冷却过后重发成功 → 新验证码替换旧验证码

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是（2026-06-08）

## 已知限制

- 用户分组筛选为客户端过滤，用户量极大（>1000）时可能影响性能，当前规模不受影响
- 密码重置和邮箱更换流程在冷却时仍存在同样的「先写后发」问题，本次未修改（使用频率低，影响小）
- `overwritePendingUserKeepToken` 仅用于冷却场景，未来若邮件发送逻辑进一步变化需重新评估

## 下一步

- 部署 Docker 镜像到 `dandwan.site` 进行完整功能验证
- 可选：为 `requestPasswordReset()` 和 `requestEmailChange()` 也修复 token 覆盖顺序
- 可选：若用户量增长，将筛选逻辑移到服务端（`GET /api/admin/users?filter=...`）
