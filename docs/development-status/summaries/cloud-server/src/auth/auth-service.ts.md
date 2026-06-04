# `cloud-server/src/auth/auth-service.ts`

## 功能
提供认证核心逻辑。包括用户登录（用户名/邮箱 + bcrypt 密码验证，返回 JWT + API Key）、用户注册（用户名/邮箱去重、密码哈希、API Key 生成）、JWT 签发与验证、管理员种子用户创建。

## 关系
### 调用 / 引用
- `cloud-server/src/logger.ts` — `createLogger`
- `bcryptjs` — 密码哈希与验证
- `jsonwebtoken` — JWT 签发与验证
- `uuid` — `v4`

### 提供
- `generateApiKey()` — 生成 `csk_` 前缀的 API Key
- `hashPassword()` — bcrypt 12 轮密码哈希
- `verifyPassword()` — bcrypt 密码比对
- `generateJwtToken()` — JWT 签发
- `verifyJwtToken()` — JWT 验证
- `loginUser()` — 用户登录（用户名/邮箱 + 密码 → JWT + API Key）
- `createUser()` — 创建新用户（去重 + 哈希 + Key 生成）
- `seedAdminUser()` — 首次运行时创建默认管理员

### 被依赖
- `cloud-server/src/auth/auth-routes.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/admin/admin-routes.ts`
- `cloud-server/src/app.ts`

## 关键词
### 函数
- `createUser`
- `generateApiKey`
- `generateJwtToken`
- `hashPassword`
- `loginUser`
- `seedAdminUser`
- `verifyJwtToken`
- `verifyPassword`

### 常量
- `API_KEY_PREFIX`
- `BCRYPT_ROUNDS`
