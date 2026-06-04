# `cloud-server/src/db/repositories/upstream-repo.ts`

## 功能
针对 `upstreams` 和 `upstream_api_keys` 表的数据库访问层。提供上游配置和 API 密钥的 CRUD 操作，支持旧版 `string[]` 到新版 `ModelEntry[]` 格式的 `models` JSON 字段向后兼容解析。处理 `api_type`、`distribution_mode` 和 `fault_tolerance` 字段。

## 关系
### 提供
- `UpstreamRepo` — 上游和 API 密钥的 CRUD 操作
- `findById()`、`findByIdWithKeys()`、`listAll()`、`listEnabled()`
- `create()`、`update()`、`delete()`
- `listKeysByUpstream()`、`listEnabledKeysByUpstream()`、`findKeyById()`
- `createKey()`、`updateKey()`、`deleteKey()`

### 调用 / 引用
- `cloud-server/src/types.ts` — `Upstream`、`UpstreamApiKey`、`UpstreamWithKeys`、`ModelEntry`
- `cloud-server/src/db/database.ts` — `DbGetter`、`autoSave`
- `cloud-server/src/db/helpers.ts` — `queryOne`、`queryAll`
