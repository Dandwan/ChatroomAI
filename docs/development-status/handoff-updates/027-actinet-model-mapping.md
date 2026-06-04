# 027 — ActiNet 全局设置：快速/专家模型映射

**日期**：2026-06-05

## 范围

为 cloud-server Admin UI 全局设置页面新增 ActiNet 模型映射配置，允许管理员设置"快速"和"专家"分别对应的实际上游模型名称。代理层在转发请求前自动将友好名称翻译为实际模型名。

## 变更的代码区域

### 修改：`cloud-server/src/config.ts`
- `ServerConfig` 接口新增 `actiNetModelMapping: Record<string, string>`
- `loadConfig()` 新增解析逻辑：环境变量 `CLOUD_SERVER_ACTINET_MODEL_MAPPING`（JSON）→ `config.json` → `{}`

### 修改：`cloud-server/src/admin/admin-routes.ts`
- `GET /api/admin/settings` 响应新增 `actiNetModelMapping` 字段
- `PUT /api/admin/settings` 接受并验证 `actiNetModelMapping`（支持 null 清空、值类型校验），即时生效 + 持久化到 `config.json`

### 修改：`cloud-server/src/proxy/proxy-routes.ts`
- 新增 `resolveFriendlyModel()` 辅助函数：查映射表，有则返回实际模型名，无则透传
- `POST /v1/chat/completions`：请求入口处解析 `effectiveModel`，用于上游选择和请求转发；请求体 `model` 字段在映射生效时替换为实际模型名；响应和日志保留原始友好名称
- `GET /v1/models`：返回列表中合并 `actiNetModelMapping` 的 key（友好名），确保客户端可发现

### 修改：`cloud-server/admin-ui/src/api.ts`
- `ServerSettings` 接口新增 `actiNetModelMapping: Record<string, string>`
- `updateSettings()` 参数新增 `actiNetModelMapping?`

### 修改：`cloud-server/admin-ui/src/pages/SettingsPage.tsx`
- 新增状态：`quickModel`、`expertModel`
- `load()` 从服务端配置读取映射初始值
- `handleSave()` 构造 mapping 对象并一并提交
- UI：新增「ActiNet 模型映射」卡片，含"快速模式对应模型"和"专家模式对应模型"两个文本输入框

### 更新：代码摘要（5 个文件）
- `summaries/cloud-server/src/config.ts.md` — 新增 `actiNetModelMapping` 配置项说明
- `summaries/cloud-server/src/admin/admin-routes.ts.md` — 新增 v6 全局设置更新说明
- `summaries/cloud-server/src/proxy/proxy-routes.ts.md` — 新增模型名映射逻辑和 `/v1/models` 变更说明
- `summaries/cloud-server/admin-ui/src/api.ts.md` — `ServerSettings` 和 `updateSettings` 变更
- `summaries/cloud-server/admin-ui/src/pages/SettingsPage.tsx.md` — UI 新增映射卡片说明

## 数据流

```
客户端发送 model="快速"
  → resolveFriendlyModel() 查映射: "快速" → "gpt-4o-mini"
  → upstream 选择用 "gpt-4o-mini" 匹配上游
  → 转发请求 body.model = "gpt-4o-mini"
  → 响应中 model 字段恢复为 "快速"
  → usage log 记录 model="快速"
```

## 设计决策

1. **`Record<string, string>` 通用映射**：后端支持任意多对映射，Admin UI 仅暴露"快速"/"专家"两个常用配置
2. **映射在请求入口处解析**：在所有业务逻辑（上游选择、容错、重试）之前完成，后续流程与常规调用完全一致
3. **响应保留友好名**：`createAnthropicStreamTransformer` 和 `anthropicToOpenaiResponse` 仍传原始 `modelName`，客户端无感知
4. **`/v1/models` 加入友好名**：通过 Set 去重合并映射 key 和实际上游模型名
5. **无 DB 变更**：配置存储在 `config.json`，无需 SQLite schema 迁移

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npm run build` — admin-ui：构建成功（390 KB JS, 7 KB CSS）

## 决策关卡

- 方案已提出：是（含完整数据流和设计决策）
- 用户确认已收到：是
- 确认：映射后走常规调用流程（容错、重试等机制不变）

## 已知限制

- 映射仅支持精确匹配（无通配符或正则）
- 友好名通过 `/v1/models` 暴露，客户端 `fetchActiNetModelsFromServer()` 会将其与实际上游模型一起拉取（新增的默认 disabled）
- 环境变量方式需要 JSON 字符串，可读性较差

## 下一步

- 部署后通过 Admin UI 设置"快速"、"专家"对应模型
- 用 API key 调用 `POST /v1/chat/completions` 验证映射生效
- 观察 `/v1/models` 返回列表是否包含友好名
- 可选：客户端从服务端动态获取友好名列表，不再硬编码 `DEFAULT_ACTINET_MODELS`
