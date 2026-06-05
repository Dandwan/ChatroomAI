# `cloud-server/admin-ui/src/pages/ApiKeysPage.tsx`

## 功能
Admin UI API 密钥管理页面。提供独立的管理员 API 密钥（不绑定用户）的完整管理界面：列表展示、创建表单（名称 + 密钥值）、一键复制（clipboard API + fallback）、内联编辑名称、启用/禁用切换、删除确认。创建成功后展示完整密钥值和复制按钮横幅。

## 关系
### 调用 / 引用
- `cloud-server/admin-ui/src/api.ts` — `fetchApiKeys`/`createApiKey`/`updateApiKey`/`deleteApiKey`、`AdminApiKeyData`

### 被依赖
- `cloud-server/admin-ui/src/App.tsx`
