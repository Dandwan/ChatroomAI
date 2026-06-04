# `cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`

## 功能
上游管理页面。支持上游完整 CRUD。表单含 API 类型选择、模型列表管理（per-model API 类型覆盖）、「从上游获取模型」按钮、API Key 管理。表格展示上游列表含类型徽章。**v5: 表单"容错次数"改为"Key 默认容错次数"（可选，对应 `key_fault_tolerance`）；Key 列表每行新增容错次数输入和显示；支持通过 `updateUpstreamKey` 更新单个 Key 的容错值。**

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`
