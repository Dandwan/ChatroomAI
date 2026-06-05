# 031 — 修复流式代理挂起和客户端超时

**日期**：2026-06-05

## 范围

修复 ActiChat 快速/专家模式无输出的问题。根因分两层：
1. **服务端**：`forwardStreamRequest` 转发所有客户端头（含 `content-length`）到上游，当模型名被重映射后 Content-Length 与实际 body 不匹配，导致上游挂起
2. **配置**：Docker 容器重建后 `actiNetModelMapping` 丢失（`config.json` 不在持久化卷中），导致友好名称无法解析
3. **客户端**：`fetch` 无超时，服务端不响应时永久等待

## 诊断过程

1. curl 对比测试：非流式正常、流式完全无响应（0 字节，连 HTTP 状态码都没有）
2. 代码对比：`forwardStreamRequest`（转发所有客户端头）vs `forwardNonStreamRequest`（仅发 Content-Type + Authorization）
3. 服务器日志确认：模型映射为 `{}` → `No upstream selected for model "快速"`
4. Docker 环境变量调试：YAML 列表格式 `- KEY='value'` 会将引号包含在值中

## 变更的代码区域

### 修改：`cloud-server/src/proxy/request-forwarder.ts`
- `forwardStreamRequest`：头构建从"转发全部客户端头"改为"仅发送 Content-Type + Authorization"（与 `forwardNonStreamRequest` 一致）
- 新增 `AbortSignal.timeout(120_000)` 防止上游无响应时永久挂起
- 新增 `response.body` 为 null 的防御处理（`res.status(statusCode).end()`）
- 新增流式结束后的 `res.end()` 调用（检查 `res.writableEnded`）
- `forwardNonStreamRequest` 也新增 `AbortSignal.timeout(120_000)`

### 修改：`src/services/chat-api.ts`
- `requestStreamCompletion`：将 `signal` 替换为 `AbortSignal.any([signal, AbortSignal.timeout(120_000)])`，结合用户取消和超时
- `requestNonStreamCompletion`：同上

### 修改：`cloud-server/docker-compose.yml`
- 新增 `CLOUD_SERVER_ACTINET_MODEL_MAPPING` 环境变量（`{"快速":"deepseek-v4-flash","专家":"deepseek-v4-pro"}`）
- 环境变量格式从列表格式改为映射格式（兼容 Docker Compose YAML 解析）

### 更新：代码摘要
- `summaries/cloud-server/src/proxy/request-forwarder.ts.md` — 新增 v9 变更说明
- `summaries/src/services/chat-api.ts.md` — 新建摘要

## 设计决策

1. **流式头与 non-streaming 对齐**：`forwardStreamRequest` 不再转发客户端头，只用 `{ Content-Type, Authorization }`。与 `forwardNonStreamRequest` 保持一致，消除所有客户端头引入的不确定性（Content-Length 不匹配、Accept 头影响上游行为等）
2. **环境变量持久化映射**：`actiNetModelMapping` 通过 `docker-compose.yml` 的 `CLOUD_SERVER_ACTINET_MODEL_MAPPING` 环境变量配置，确保容器重建后不丢失
3. **双重超时保护**：服务端和客户端各设 120s 超时，任一触发都能终止挂起

## 验证

- `npx tsc --noEmit` — 主项目：零错误
- `npx tsc --noEmit` — cloud-server：零错误
- `npm run build` — 构建成功（748 KB JS）
- curl 流式测试：
  - OpenAI 流式 + 快速模型 → ✅ SSE 数据正常接收
  - OpenAI 流式 + 专家模型 → ✅ SSE 数据正常接收
  - 服务器日志：`Chat completion finished` 正常

## 决策关卡

- 方案已提出：是（含详细工程方案、根因分析、替代方案对比）
- 用户确认已收到：是

## 已知限制

- 超时值硬编码为 120s（对极长推理场景可能不足，但远超正常范围）
- 流式转发不再透传客户端自定义头（如 `X-` 前缀头），如有特殊需求需后续添加白名单
- `config.json` 的 Admin UI 写入无法跨容器重建持久化（因为不在 volume 中）；映射现已通过 env var 固化
- Docker 部署脚本不包含 `config.json` 持久化处理

## 下一步

- 在 Android 设备上验证 ActiChat 客户端流式输出的完整体验
- 观察客户端 120s 超时是否能正确触发流式→非流式回退
- 可选：将 `config.json` 路径改为 `/app/data/config.json` 以纳入持久化卷
- 可选：通过 Admin UI 管理 ActiNet 模型映射（替代环境变量）
