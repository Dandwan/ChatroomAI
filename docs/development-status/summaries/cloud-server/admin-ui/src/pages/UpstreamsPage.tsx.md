# `cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`

## 功能
上游管理页面。支持上游完整 CRUD。表单含 API 类型选择、模型列表管理（per-model API 类型覆盖）、「从上游获取模型」按钮、API Key 管理。表格展示上游列表含类型徽章。**v5: 表单"容错次数"改为"Key 默认容错次数"（可选，对应 `key_fault_tolerance`）。Key 列表不再显示每 Key 的容错输入，列标题从「Keys (容错)」改为「Keys」。移除了 `handleUpdateKeyFt` 函数和 `updateUpstreamKey` 导入，`handleAddKey` 不再传递 `fault_tolerance`。**

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`
