# 028 — Cloud Server 功能补全（TLS + 代理 + 热重载 + Gemini 翻译 + WebSocket + 管理 API/UI）

**日期**：2026-06-05

## 范围

基于 CPA (CLIProxyAPI) 差距分析，补全 ChatroomAI Cloud Server 的 6 项关键功能，并增强管理后台。分 4 个阶段实施。

## Phase 1: 基础设施增强

### TLS/HTTPS 支持
- `config.ts` — 新增 `tls.enable/cert/key` 配置项（环境变量 + config.json），默认关闭
- `index.ts` — 条件创建 `https.createServer` 或 `http.createServer`，证书加载失败自动降级 HTTP
- `app.ts` — 不再内部 `app.listen`，server 由 `index.ts` 创建

### 代理转发增强
- `config.ts` — 新增全局 `proxyUrl` 配置项
- `proxy-agent.ts` — 新增 `getProxyDispatcher()` 函数，支持 SOCKS5 代理（通过 socks-proxy-agent 创建 undici 兼容 dispatcher）
- `request-forwarder.ts` — 流式/非流式转发均调用 `getProxyDispatcher`，将 dispatcher 传入 `fetch` 选项
- 优先级：上游 `proxy_url` > 全局 `proxyUrl` > 直连

### 配置热重载
- `config.ts` — 新增 `reloadConfigFromFile()` 函数，对比 delta 返回变更字段
- `app-context.ts` — 新增 `updateConfig(delta)` 方法，合并配置到运行时
- `watcher/config-watcher.ts` — **新建**，使用 `fs.watch` + 500ms 防抖监听 `config.json`
- `app.ts` — `createApp` 末尾启动 `startConfigWatcher(ctx)`
- 支持热重载：logLevel、defaultFaultTolerance、actiNetModelMapping、proxyUrl、wsAuth、healthCheckIntervalMs
- 不支持热重载：端口、TLS、DB 路径（需重启）

## Phase 2: Gemini 格式翻译

### 新增 API 类型
- `types.ts` — 新增 `ApiType = 'openai' | 'anthropic' | 'gemini'`，`Upstream.api_type` 和 `ModelEntry.api_type` 使用该类型
- `proxy/format-gemini.ts` — **新建**，OpenAI ↔ Gemini 格式转换器：
  - `openaiToGeminiRequest()` — messages→contents、system→systemInstruction、图片→inlineData、generationConfig
  - `geminiToOpenaiResponse()` — candidates→choices、usageMetadata→usage、finishReason 映射
  - `createGeminiStreamTransformer()` — Gemini SSE→OpenAI SSE TransformStream

### 代理路由重构
- `proxy-routes.ts` — 用 `getRouting(apiType)` 查表模式替换 `isAnthropic` if/else，统一处理 openai/anthropic/gemini 三种类型
- `model-strategy.ts` — `resolveApiType()` 返回类型改为 `ApiType`

### Admin UI 适配
- `UpstreamsPage.tsx` — API 类型下拉新增「Gemini」选项，新增 `apiTypeLabel()`/`apiTypeBadgeClass()` 辅助函数
- `admin.css` — 新增 `.admin-badge-gemini` 样式（紫色徽章）

## Phase 3: WebSocket 支持

### 核心模块
- `ws/ws-manager.ts` — **新建**，`WsManager` 类：连接注册/移除/广播/统计
- `ws/ws-server.ts` — **新建**，`createWsServer(server, ctx)`：创建 WebSocketServer（ws 库），挂载到 `/v1/ws`，支持 API Key 认证（`?token=` 或 `Authorization: Bearer`）

### 集成
- `index.ts` — 创建 HTTP server 后调用 `createWsServer(server, ctx)`，设置 `ctx.wsManager`
- `config.ts` — 新增 `wsAuth: boolean` 配置（默认 true）
- `app-context.ts` — `AppContext` 新增 `wsManager?: WsManager`

## Phase 4: 管理 API + Admin UI

### 新增管理 API 端点
- `GET /api/admin/logs` — 分页日志查询（status/userId/upstreamId/since 筛选，富化 user_email/upstream_name）
- `GET /api/admin/logs/stream` — SSE 实时日志流（2s 轮询）
- `GET /api/admin/stats/usage/detail` — 按 user/model/upstream 分组统计
- `GET /api/admin/stats/server` — 服务器指标（运行时间、内存、WS 连接数、24h 请求数）
- `GET /api/admin/health/keys` — 所有 Key 健康状态

### 全局设置扩展
- `PUT /api/admin/settings` — 新增 `proxyUrl`、`wsAuth` 配置项（即时生效 + config.json 持久化）
- `GET /api/admin/settings` — 响应新增 `proxyUrl`、`wsAuth`、`tlsEnable`、`tlsCert`、`tlsKey`

### 数据库仓储扩展
- `usage-repo.ts` — 新增 `queryLogs()`（分页+筛选）、`getUsageDetail()`（分组统计）、`countSince()`（计数）

### Admin UI 新建页面
- `pages/LogsPage.tsx` — 日志查看：表格+分页+状态筛选+SSE 实时推送开关（新日志绿色渐入动画）
- `pages/HealthPage.tsx` — Key 健康监控：统计卡片+按上游分组表格+30s 自动刷新

### Admin UI 页面增强
- `DashboardPage.tsx` — 新增服务器状态卡片（运行时间/内存/WS 连接/24h 请求数），30s 自动刷新
- `SettingsPage.tsx` — 新增「代理转发」和「WebSocket 认证」配置区块
- `Layout.tsx` — 导航新增「日志」「健康」
- `api.ts` — 新增 `LogEntry`、`LogsData`、`UsageDetailData`、`ServerMetrics`、`KeyHealthData` 接口和对应 API 函数；`ApiType` 类型别名
- `admin.css` — 新增分页、复选框、下拉选择、统计卡片、日志行动画、信息网格等样式

## 新建文件（8 个）
```
cloud-server/src/watcher/config-watcher.ts
cloud-server/src/proxy/format-gemini.ts
cloud-server/src/ws/ws-manager.ts
cloud-server/src/ws/ws-server.ts
cloud-server/admin-ui/src/pages/LogsPage.tsx
cloud-server/admin-ui/src/pages/HealthPage.tsx
```

## 修改文件（18 个）
```
cloud-server/src/config.ts
cloud-server/src/index.ts
cloud-server/src/app.ts
cloud-server/src/app-context.ts
cloud-server/src/types.ts
cloud-server/src/proxy/proxy-agent.ts
cloud-server/src/proxy/request-forwarder.ts
cloud-server/src/proxy/proxy-routes.ts
cloud-server/src/proxy/model-strategy.ts
cloud-server/src/admin/admin-routes.ts
cloud-server/src/db/repositories/usage-repo.ts
cloud-server/admin-ui/src/api.ts
cloud-server/admin-ui/src/App.tsx
cloud-server/admin-ui/src/components/Layout.tsx
cloud-server/admin-ui/src/pages/DashboardPage.tsx
cloud-server/admin-ui/src/pages/SettingsPage.tsx
cloud-server/admin-ui/src/pages/UpstreamsPage.tsx
cloud-server/admin-ui/src/styles/admin.css
```

## 新增依赖
- `ws` — WebSocket server
- `@types/ws` — TypeScript 类型
- `socks-proxy-agent` — SOCKS5 代理

## 设计决策

1. **API 类型路由用查表模式**：`getRouting(apiType)` 返回 `ApiTypeRouting` 对象（path/reqConv/resConv/streamConv），替代 if/else 分支，扩展新 API 类型只需在 switch 中添加一个 case
2. **TLS 默认关闭 + 自动降级**：证书加载失败时自动回退 HTTP，不阻塞启动
3. **SOCKS5 用 undici Dispatcher**：socks-proxy-agent 兼容 undici Dispatcher 接口，直接传入 `fetch` 的 `dispatcher` 选项
4. **配置热重载仅非结构性字段**：端口/TLS/DB 路径热重载无意义（需重新 bind/listen），仅热重载 logLevel 等运行时配置
5. **WS 认证可选**：`wsAuth` 默认 true，管理员可在 Admin UI 中关闭以允许匿名连接
6. **日志 SSE 可选开关**：默认关闭不消耗连接，用户按需开启

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npx vite build` — admin-ui：构建成功（390 KB JS, 8.5 KB CSS）

## 决策关卡

- 方案已提出：是（含详细工程方案、修订版）
- 用户确认已收到：是
- 需求修订：
  - 无需 OAuth 反代（不做 Codex/Gemini-CLI OAuth）
  - Gemini 使用标准 Google Generative Language API 路径
  - 日志页面 SSE 为可选开关

## 已知限制

- Gemini-CLI 和 Codex OAuth 场景不在本次范围（用户确认无需）
- 配置热重载不支持端口/TLS 变更（需重启）
- WebSocket 当前为消息回显模式（上游转发待后续实现）
- SSE 日志流在无新日志时发送 keepalive 注释
- 无数据库迁移（API 类型扩展仅代码层）

## 下一步

- 部署到云服务器验证全功能
- 配置 Gemini upstream 并通过 `/v1/chat/completions` 测试转发
- 观察 WebSocket 连接和日志 SSE 的实际表现
- 可选：实现 WebSocket 上游消息转发
