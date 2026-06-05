# `cloud-server/src/db/repositories/api-key-repo.ts`

## 功能
管理员 API 密钥数据仓库。提供 `ApiKeyRepo` 类，封装 `api_keys` 表的 CRUD 操作：`findById()`、`findByApiKey()`（按密钥值查找已启用的 Key）、`listAll()`、`create()`、`update()`、`markUsed()`（更新最后使用时间）、`delete()`。密钥值明文存储（与上游 API Key 一致）。

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts` — `AdminApiKey`
- `cloud-server/src/db/database.ts` — `DbGetter`、`autoSave`
- `cloud-server/src/db/helpers.ts` — `queryOne`、`queryAll`

### 提供
- `ApiKeyRepo` — 含 `findById`/`findByApiKey`/`listAll`/`create`/`update`/`markUsed`/`delete`

### 被依赖
- `cloud-server/src/app-context.ts`
- `cloud-server/src/auth/middleware.ts`
- `cloud-server/src/admin/admin-routes.ts`

## 关键词
### 类
- `ApiKeyRepo`
### 函数
- `keyFromRow`
