# `cloud-server/src/db/migrations.ts`

## 功能
数据库模式迁移模块。基于 schema_version 表实现版本化迁移，按版本号递增应用 SQL DDL 语句。当前包含 7 个迁移版本：v1 核心表，v2 upstreams 重构 + model_priorities，v3 api_type 列，v4 fault_tolerance 列，v5 upstream_api_keys.fault_tolerance + upstreams.key_fault_tolerance 列（per-key 健康机制），v6 邮箱验证（email_verified、email_verify_token、email_verify_token_expires_at），**v7 密码重置 + 待定邮箱（password_reset_token、password_reset_token_expires_at、pending_email 列）。v8: 新建 `api_keys` 表（管理员创建的独立 API 密钥，不绑定用户）。**

## 关系
### 调用 / 引用
- `cloud-server/src/db/database.ts` — `saveDatabase`
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `runMigrations()` — 按需执行待处理的迁移

### 被依赖
- `cloud-server/src/db/database.ts` — 初始化时调用
