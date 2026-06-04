# `cloud-server/src/db/migrations.ts`

## 功能
数据库模式迁移模块。基于 schema_version 表实现版本化迁移，按版本号递增应用 SQL DDL 语句。当前包含 3 个迁移版本：v1 创建所有核心表（users、admin_users、upstreams、upstream_api_keys、usage_logs、health_checks），v2 重构 upstreams 表并新增 model_priorities 表，v3 为 upstreams 增加 api_type 列。

## 关系
### 调用 / 引用
- `sql.js` — `Database`
- `cloud-server/src/db/database.ts` — `saveDatabase`
- `cloud-server/src/logger.ts` — `createLogger`

### 提供
- `runMigrations()` — 检查并执行待处理迁移

### 被依赖
- `cloud-server/src/db/database.ts`

## 关键词
### 函数
- `runMigrations`
### 常量
- `SCHEMA_VERSION_TABLE`
- `MIGRATIONS`
