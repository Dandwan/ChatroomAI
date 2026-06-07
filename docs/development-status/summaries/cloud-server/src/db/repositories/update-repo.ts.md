# `cloud-server/src/db/repositories/update-repo.ts`

## 功能
SoftwareUpdate 数据仓库层。提供软件更新配置的完整 CRUD 及灰度发布判定逻辑。`findUpdateForVersion()` 根据客户端版本号查找可用更新；`shouldRolloutToUser()` 实现三种灰度模式（全量/百分比/指标选择）；`incrementDownloadCount()` 统计下载次数。

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts` — `SoftwareUpdate`、`UpdateRolloutMode`
- `cloud-server/src/db/database.ts` — `DbGetter`、`autoSave`
- `cloud-server/src/db/helpers.ts` — `queryOne`、`queryAll`

### 提供
- `UpdateRepo` 类
- `UserForRollout` 接口

### 被依赖
- `cloud-server/src/app-context.ts` — 初始化
- `cloud-server/src/admin/admin-routes.ts` — 管理端 CRUD
- `cloud-server/src/update/update-routes.ts` — 客户端检查/下载

## 关键词
### 类
- `UpdateRepo`

### 方法
- `findById`、`listAll`、`listEnabled`
- `create`、`update`、`delete`
- `findUpdateForVersion`、`shouldRolloutToUser`
- `incrementDownloadCount`

### 函数
- `simpleHash` — 确定性字符串哈希（用于百分比灰度）
