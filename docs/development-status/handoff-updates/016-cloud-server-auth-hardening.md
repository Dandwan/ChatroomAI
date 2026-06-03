# 016 — Cloud Server 认证系统安全加固

**日期**：2026-06-03

## 范围

对 cloud-server 的认证系统进行安全加固，包含：新增用户注册端点、修复 `/api/auth/me` 中间件缺失、为登录和注册端点添加 IP 级防暴力破解限流、JWT Secret 生产环境警告。

## 变更的代码区域

### 新增：`cloud-server/src/auth/ip-rate-limiter.ts`
- IP 级别速率限制中间件，与现有的用户级 `rate-limiter.ts` 互补
- 提供通用工厂函数 `createIpRateLimiter()` 和两个预配置实例：
  - `createLoginRateLimiter()` — 5 次/分钟/IP（登录端点）
  - `createRegisterRateLimiter()` — 3 次/小时/IP（注册端点）
- 使用 `Map<string, Counter>` 内存计数，每 5 分钟清理过期条目
- 通过 `req.ip` / `X-Forwarded-For` 获取客户端 IP

### 修改：`cloud-server/src/auth/auth-routes.ts`
- **新增** `POST /api/auth/register` — 用户注册端点，注册成功后自动登录返回 JWT
- **修复** `GET /api/auth/me` — 挂载 `createApiKeyAuth` 中间件，移除冗余的空值检查
- **加固** `POST /api/auth/login` — 挂载 `createLoginRateLimiter` 中间件

### 修改：`cloud-server/src/admin/admin-routes.ts`
- **加固** `POST /api/admin/login` — 挂载 `createLoginRateLimiter` 中间件

### 修改：`cloud-server/src/config.ts`
- 新增 JWT Secret 随机生成检测：若无环境变量或配置文件显式设置，启动时打印警告

### 新增：代码摘要（6 个文件）
- `summaries/cloud-server/src/auth/ip-rate-limiter.ts.md`
- `summaries/cloud-server/src/auth/auth-routes.ts.md`
- `summaries/cloud-server/src/auth/auth-service.ts.md`
- `summaries/cloud-server/src/auth/middleware.ts.md`
- `summaries/cloud-server/src/config.ts.md`
- `summaries/cloud-server/src/admin/admin-routes.ts.md`

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- 所有新增/修改文件编译通过

## 决策关卡

- 方案已提出：是（包含完整 API 契约、速率限制参数、错误处理策略）
- 用户确认已收到：是
- 用户特别指示：密码规则保持自由，不添加强度校验

## 已知限制 / 跳过的检查

- IP 限流使用 `req.ip`，在反向代理后需配置 `trust proxy` 才能获取真实客户端 IP
- 未添加 `helmet` 安全头、httpOnly cookie、API Key 轮换 — 这些属于独立的加固任务
- 未修改客户端代码（`cloud-auth.ts`），注册端点返回的响应格式与登录一致，前端可复用现有 `CloudLoginPage`
- 未修改 Admin UI
- 未引入任何新的 npm 依赖

## 待解决问题 / 风险

- 速率限制计数器存于内存，多实例部署需共享存储（Redis 等）
- `register` 端点无邮箱验证机制——当前项目阶段可接受，后续可通过插件系统添加

## 下一步

- 部署时设置 `CLOUD_SERVER_JWT_SECRET` 环境变量以避免 Token 在重启后失效
- 配置反向代理时设置 `trust proxy` 以确保 IP 限流正确获取客户端 IP
- 考虑在后续迭代中添加邮箱验证流程和 API Key 轮换端点
