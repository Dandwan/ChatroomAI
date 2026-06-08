# `cloud-server/admin-ui/src/pages/ModelPrioritiesPage.tsx`

## 功能
模型策略页面。按模型配置上游优先级排序（优先响应 / 回退顺序），支持上移/下移/删除。顶部选择器添加某模型的上游优先级。v16：加载态改为 `SkeletonTable` 骨架屏 + 页面副标题。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchUpstreams` / `fetchModelPriorities` / `createModelPriority` / `reorderModelPriorities` / `deleteModelPriority`
- `cloud-server/admin-ui/src/components/Skeleton.tsx` — `SkeletonTable`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`

## 关键词
### 函数
- `ModelPrioritiesPage`
