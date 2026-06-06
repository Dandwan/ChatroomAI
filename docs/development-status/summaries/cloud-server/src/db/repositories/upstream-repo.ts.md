# `cloud-server/src/db/repositories/upstream-repo.ts`

## 功能
上游和 API Key 的数据库仓储层。上游 CRUD（`findById`、`listAll`、`listEnabled`、`create`、`update`、`delete`）和 API Key CRUD（`createKey`、`updateKey`、`deleteKey`、`findKeyById`）。支持 models JSON 向后兼容解析。**v5: `upstreamFromRow` 使用 `key_fault_tolerance`。v6: `keyFromRow` 重新读取 `fault_tolerance` 字段（per-key 容错）；`createKey` INSERT 新增 `fault_tolerance` 列；`updateKey` Pick 类型和 fields 数组新增 `fault_tolerance`。**

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts`
- `cloud-server/src/db/database.ts` — `DbGetter`、`autoSave`
- `cloud-server/src/db/helpers.ts` — `queryOne`、`queryAll`

### 提供
- `UpstreamRepo` 类

### 被依赖
- `cloud-server/src/app-context.ts` — 初始化
- `cloud-server/src/admin/admin-routes.ts`
- `cloud-server/src/upstream/health-checker.ts`
- `cloud-server/src/proxy/proxy-routes.ts`
