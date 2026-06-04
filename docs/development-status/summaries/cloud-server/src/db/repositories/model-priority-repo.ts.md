# `cloud-server/src/db/repositories/model-priority-repo.ts`

## 功能
模型优先级配置的数据访问层（Repository）。管理 `model_priorities` 表的 CRUD 操作，支持按模型名查询优先级列表、批量重排上游顺序。

## 关系
### 调用 / 引用
- `cloud-server/src/types.ts` — `ModelPriority` 类型
- `cloud-server/src/db/database.ts` — `autoSave`、`DbGetter`
- `cloud-server/src/db/helpers.ts` — `queryOne`、`queryAll`

### 提供
- `ModelPriorityRepo` — 类

### 被依赖
- `cloud-server/src/app-context.ts` — 注入到 `repos`

## 关键词
### 类
- `ModelPriorityRepo`

### 函数
- `modelPriorityFromRow`
