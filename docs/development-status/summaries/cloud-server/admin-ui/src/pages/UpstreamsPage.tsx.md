# `cloud-server/admin-ui/src/pages/UpstreamsPage.tsx`

## 功能
上游管理页面。支持上游的完整 CRUD 操作。表单包含 API 类型选择（OpenAI / Anthropic）、模型列表管理（支持 per-model API 类型覆盖）、「从上游获取模型」按钮（调用后端 fetch-models 端点自动填充模型列表）、API Key 管理。表格展示上游列表，含类型徽章和操作按钮。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — 所有 API 调用

### 被依赖
- `cloud-server/admin-ui/src/App.tsx` — 页面路由
