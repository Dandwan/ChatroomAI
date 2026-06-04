# 021 — 上游 Anthropic 兼容 + 模型列表获取

**日期**：2026-06-04

## 范围

三个核心变更：
1. 上游增加 API 类型标记（OpenAI / Anthropic），支持 upstream 全局默认 + per-model 覆盖
2. 代理层透明转换：客户端始终以 OpenAI 格式请求，代理根据上游/模型 API 类型自动转换为 Anthropic 格式（请求体 → `/v1/messages` → 响应反向转换），支持流式和非流式
3. Admin UI「获取模型」按钮：从上游 `/v1/models` 端点自动拉取模型列表，支持 OpenAI 和 Anthropic 两种上游

## 后端变更

### 修改：`cloud-server/src/types.ts`
- 新增 `ModelEntry` 接口（`name`, `api_type?`）
- `Upstream` 新增 `api_type: 'openai' | 'anthropic'`，`models` 由 `string[]` 改为 `ModelEntry[]`

### 修改：`cloud-server/src/db/migrations.ts`
- 新增 v3 迁移：`upstreams` 表新增 `api_type TEXT NOT NULL DEFAULT 'openai'`
- 旧 `models` JSON 格式（`string[]`）在应用层 `upstreamFromRow` 中自动兼容转换为 `ModelEntry[]`

### 修改：`cloud-server/src/db/repositories/upstream-repo.ts`
- `upstreamFromRow()` 新增 `api_type` 解析和 `models` 向后兼容解析（`parseModels()` 同时支持旧 `string[]` 和新 `ModelEntry[]` 格式）
- `create()`/`update()` 新增 `api_type` 字段处理

### 新建：`cloud-server/src/proxy/format-converter.ts`
- `openaiToAnthropicRequest()` — OpenAI 请求体 → Anthropic Messages API 格式
- `anthropicToOpenaiResponse()` — Anthropic 响应 → OpenAI chat completion 格式
- `createAnthropicStreamTransformer()` — 创建 TransformStream，将 Anthropic SSE 流事件转换为 OpenAI SSE 格式

### 修改：`cloud-server/src/proxy/request-forwarder.ts`
- 新增 `StreamForwardOptions` 接口（`body?`, `streamTransformer?`）
- `forwardStreamRequest()` 支持自定义请求体和流式 TransformStream 管道

### 修改：`cloud-server/src/proxy/proxy-routes.ts`
- `POST /v1/chat/completions` 端点根据 `selected.apiType` 决定转发路径：
  - `openai` → 直接转发 `/v1/chat/completions`
  - `anthropic` → 转换请求体 → `/v1/messages` → 转换响应/SSE

### 修改：`cloud-server/src/proxy/model-strategy.ts`
- `ModelSelectionResult` 新增 `apiType: 'openai' | 'anthropic'`
- 新增 `resolveApiType()` — 模型级覆盖优先，回退到上游全局默认
- `getAvailableModels()` 适配 `ModelEntry[]`（提取 `.name`）
- `upstreamHasModel()` 适配 `ModelEntry[]`（检查 `.name` 匹配）

### 修改：`cloud-server/src/proxy/upstream-selector.ts`
- 无模型名的回退路径返回 `apiType: upstream.api_type ?? 'openai'`

### 修改：`cloud-server/src/admin/admin-routes.ts`
- POST/PUT 上游端点适配 `api_type` 和新的 `models` 格式
- **新增** `POST /api/admin/upstreams/:id/fetch-models` — 使用上游 API Key 调用 `GET {base_url}/v1/models`，解析并返回模型名称列表，10s 超时

## Admin UI 变更

### 修改：`admin-ui/src/api.ts`
- 新增 `ModelEntryData` 接口
- `UpstreamData` 新增 `api_type`，`models` 改为 `ModelEntryData[]`
- `createUpstream()` 参数新增 `api_type?`、`models?` 改为 `ModelEntryData[]`
- 新增 `fetchUpstreamModels(upstreamId)` API 函数

### 修改：`admin-ui/src/pages/UpstreamsPage.tsx`
- 表单新增「API 类型」下拉选择器（OpenAI / Anthropic）
- 模型列表重构为逐条管理：每个模型可单独设置 API 类型（继承上游 / 强制 OpenAI / 强制 Anthropic）
- 新增「从上游获取模型」按钮（表格行内 + 编辑表单内）
- 表格新增「类型」列（OpenAI / Anthropic 彩色徽章）
- 模型列显示 per-model API 类型覆盖（如 `claude-opus-4-8 (Anthropic)`）

### 修改：`admin-ui/src/styles/admin.css`
- 新增 `.admin-label-row`、`.admin-models-list`、`.admin-model-entry`、`.admin-model-name` 样式
- 新增 `.admin-badge`、`.admin-badge-openai`、`.admin-badge-anthropic` 徽章样式

### 修复：`admin-ui/src/pages/ModelPrioritiesPage.tsx`
- 适配 `models` 字段从 `string[]` 到 `ModelEntryData[]` 的变更（使用 `.some(m => m.name === ...)` 和 `.map(m => m.name)`）

## 设计决策

1. **客户端始终 OpenAI 格式**：代理透明转换，客户端无需感知上游类型
2. **模型级 API 类型覆盖优先于上游全局默认**：`modelEntry.api_type ?? upstream.api_type`
3. **模型获取复用通用端点**：`/v1/models` 在 OpenAI 和 Anthropic API 上均可用且格式相似
4. **数据库迁移自动兼容**：旧 `string[]` models 在读取时自动转换为 `ModelEntry[]`，无需手动迁移数据

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npm run build` — admin-ui：构建成功（384 KB JS, 6.2 KB CSS）

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是

## 已知限制

- Anthropic 格式转换仅覆盖最常用字段（text content、usage、stop_reason），高级功能（tool use、citations）暂不映射
- 流式转换的 token 统计依赖 Anthropic SSE 事件中的 `message_delta.usage` 字段
- 模型获取超时固定 10 秒，不可配置

## 下一步

- 部署后测试真实 OpenAI 和 Anthropic 上游的代理转发
- 验证流式 Anthropic 请求的 SSE 转换正确性
- 可选：支持 tool_use / citations 等高级 Anthropic 字段的映射
