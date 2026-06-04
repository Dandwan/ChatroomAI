# `cloud-server/src/db/database.ts`

## 功能
SQLite 数据库生命周期管理。基于 sql.js 的纯 JavaScript SQLite 实现，支持数据库的初始化、持久化（读写文件）、迁移执行、自动保存和优雅关闭。提供同步和异步的数据库访问接口，启用外键约束。

## 关系
### 调用 / 引用
- `sql.js` — `initSqlJs`, `Database`, `SqlJsStatic`
- `cloud-server/src/db/migrations.ts` — `runMigrations`
- `cloud-server/src/logger.ts` — `createLogger`
- `node:fs` — `readFileSync`, `writeFileSync`, `existsSync`

### 提供
- `getDatabase()` — 异步初始化并获取数据库实例（含迁移）
- `getDbSync()` — 同步获取已初始化的数据库实例
- `saveDatabase()` — 将内存数据库写入磁盘
- `autoSave()` — 自动保存（直接调用 `saveDatabase`）
- `closeDatabase()` — 保存并关闭数据库
- `DbGetter` — 数据库获取器类型

### 被依赖
- `cloud-server/src/app.ts`
- `cloud-server/src/index.ts`
- `cloud-server/src/db/repositories/*` — 所有数据仓库
- `cloud-server/src/db/migrations.ts`

## 关键词
### 函数
- `getDatabase`
- `getDbSync`
- `saveDatabase`
- `autoSave`
- `closeDatabase`
- `getSqlJs`

### 类型
- `DbGetter`
