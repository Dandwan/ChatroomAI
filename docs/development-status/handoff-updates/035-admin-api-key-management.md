# 035 — 云服务后台 API Key 管理

**日期**：2026-06-06

## 范围

在云服务管理后台新增独立的 API Key 管理功能。管理员可直接在 Admin UI 创建、查看、编辑、删除 API 密钥，不绑定用户账号体系。创建的 Key 可作为独立的 API 认证凭证调用代理端点。

## 变更的代码区域

### 新建（2 个）
```
cloud-server/src/db/repositories/api-key-repo.ts
cloud-server/admin-ui/src/pages/ApiKeysPage.tsx
```

### 修改（9 个）
```
cloud-server/src/types.ts                       — 新增 AdminApiKey 接口
cloud-server/src/db/migrations.ts               — v8 迁移：创建 api_keys 表
cloud-server/src/app-context.ts                 — repos 新增 apiKeys
cloud-server/src/auth/middleware.ts             — createApiKeyAuth 双表查询（users → api_keys）
cloud-server/src/admin/admin-routes.ts          — 新增 4 个 API Key 管理端点
cloud-server/admin-ui/src/api.ts                — 新增 AdminApiKeyData + 4 个 API 函数
cloud-server/admin-ui/src/App.tsx               — 新增 'api-keys' 路由
cloud-server/admin-ui/src/components/Layout.tsx — 导航新增「API 密钥」
cloud-server/admin-ui/src/styles/admin.css      — 新增创建横幅 + 复制按钮样式
```

## 架构设计

### 独立密钥体系
- 新增 `api_keys` 表（v8 迁移），存储独立的管理员 API 密钥
- 密钥值明文存储（与 `upstream_api_keys` 一致）
- 不绑定用户账号，`created_by` 记录创建者管理员用户名
- `last_used_at` 追踪最后使用时间

### 认证中间件升级
- `createApiKeyAuth` 改为双表查询：先查 `users` → 再查 `api_keys`
- API Key 认证时自动更新 `last_used_at`
- 两种 Key 都支持禁用检查

### 新增端点
| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/admin/api-keys` | 列出所有 Key |
| `POST` | `/api/admin/api-keys` | 创建 Key（`{ name, api_key }`） |
| `PUT` | `/api/admin/api-keys/:id` | 更新名称/启用状态 |
| `DELETE` | `/api/admin/api-keys/:id` | 删除 Key |

### Admin UI 功能
- 创建表单：手动填写名称和密钥值
- 列表展示：名称、掩码 Key（前 8 字符）、状态、最后使用时间、操作
- 一键复制：每行 📋 按钮 + 创建成功横幅（Clipboard API + fallback）
- 内联编辑名称、启用/禁用切换、删除确认

## 设计决策

1. **独立数据表**：`api_keys` 表与 `users` 表完全分离，不修改现有用户体系
2. **明文存储**：与 `upstream_api_keys` 一致，管理员自行保管
3. **无 bcrypt/密码**：创建时直接填写原始 Key，不衍生额外字段
4. **双表认证**：中间件先查用户表再查 Key 表，优先级用户 Key > 独立 Key
5. **创建后完整显示**：与用户注册后的 API Key 处理一致，仅创建时返回完整值，列表页掩码显示

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npx tsc --noEmit` — 主项目：零错误
- `npx vite build` — admin-ui：构建成功（390 KB JS, 9.0 KB CSS）

## 决策关卡

- 方案已提出：是（含详细工程方案，需求讨论 3 轮修订）
- 用户确认已收到：是
- 需求修订：
  1. 创建时无需用户名/密码，直接填写 Key 和名称
  2. 不需要邮箱验证流程
  3. 不要绑定普通用户体系
  4. 支持一键复制

## 已知限制

- API Key 明文存储在数据库中，无加密（与 `upstream_api_keys` 一致）
- 创建后仅显示一次完整值，无法重新查看
- Key 与用户 Key 共享同一限流体系（如需独立限流可后续扩展）
- 不支持 Key 过期时间

## 下一步

- 部署后通过 Admin UI 创建生产环境 API Key 测试认证
- 可选：为独立 Key 增加独立的速率限制
- 可选：支持 Key 过期时间配置
- 可选：增加 Key 使用统计和审计日志
