# 051 — ActiNet 对齐 CPA 翻译行为

**日期**：2026-06-07

## 范围

基于 proxy-diff 测试套件对 CPA vs ActiNet 的逐阶段对比分析，将 ActiNet 的 Anthropic → OpenAI 格式转换行为修改为与 CPA 完全一致。共涉及 3 个文件、3 个行为差异。

## 差异分析与变更

### 差异 1：缓存策略反转（`format-converter.ts`）

**根因**：ActiNet 原样保留 Anthropic 请求 system 内容块中的 `cache_control` 字段。Claude Code 在首轮请求时会带 `cache_control`（但多轮时可能不加），导致 ActiNet 的缓存行为与 CPA 完全相反。

**CPA 行为**：
- 始终先剥离所有 system 内容块的 `cache_control`
- 首轮（`messages.length === 1`）：不加任何 `cache_control`
- 多轮（`messages.length > 1`）：仅对 block[1] 和 block[2]（跳过 billing header block[0]）添加 `cache_control: {type: "ephemeral"}`

**修改**：`anthropicToOpenaiRequest()` 的 system 处理逻辑重写：
```typescript
// 剥离所有已有 cache_control
const cleanBlocks = system.filter(s => s.type === 'text')
  .map(s => { const { cache_control, ...rest } = s; return rest })

// 仅多轮时重新添加（跳过 billing header block[0]）
const isMultiTurn = anthropicMessages.length > 1
if (isMultiTurn) {
  for (let i = 1; i < Math.min(cleanBlocks.length, 3); i++) {
    cleanBlocks[i] = { ...cleanBlocks[i], cache_control: { type: 'ephemeral' } }
  }
}
```

### 差异 2：空 assistant content（`format-converter.ts`）

**根因**：ActiNet 在 assistant 消息既无文本也无 tool_use 时使用 `content: ''`（空字符串），以避免某些上游的拒绝。CPA 使用 `content: null`。

**修改**：第 442 行 `openaiMsg.content = ''` → `openaiMsg.content = null`。已确认同一上游（OpenCode/DeepSeek V4 Pro）接受 `null`。

### 差异 3：上游 Anthropic 协议头转发

**根因**：ActiNet 将客户端请求中的 `anthropic-version`、`anthropic-beta`、`x-api-key` 转发给上游 OpenAI 兼容 API。CPA 不转发这些 Anthropic 特定头。

**修改**：
- `request-forwarder.ts`：移除 `forwardStreamRequest()` 中的 Anthropic 头转发循环（4 行）
- `proxy-routes.ts`：移除 `forwardChatCompletion()` 中的 `extraHeaders` 收集逻辑及 `forwardNonStreamRequest` 传参（6 行）

## 涉及文件

| 文件 | 变更 |
|------|------|
| `cloud-server/src/proxy/format-converter.ts` | ~25 行修改 — 缓存策略重写 + null content |
| `cloud-server/src/proxy/request-forwarder.ts` | 4 行删除 — 移除 Anthropic 头转发 |
| `cloud-server/src/proxy/proxy-routes.ts` | 6 行删除 — 移除 extraHeaders |

## 验证

- `npx tsc --noEmit` — cloud-server：**零错误**
- Docker 镜像构建成功，容器运行中
- ActiNet API 端点正常响应（`POST /v1/messages` 返回 503 "没有可用上游"，因上游配置尚未恢复）

### 待完成验证

- 恢复上游配置后运行 `proxy-diff once` 测试
- 验证 5 个 session 的对比报告中 cache_control、upstream headers、content type 与 CPA 一致

## 决策关卡

- 方案已提出：是（含 proxy-diff 精确对比数据 + 逐行代码定位）
- 用户确认已收到：是

## 已知限制

1. proxy-diff 端到端验证因上游配置丢失（手递手 048 数据丢失事故）尚未执行
2. 用户消息 content 类型（list vs str）在测试数据中也存在首轮/多轮反转模式，但根因尚未完全确定（部署代码行为与测试数据的矛盾需等新测试数据验证）
3. `extraHeaders` 参数在 `forwardNonStreamRequest` 签名中保留但不再传入值，如未来有上游需要 Anthropic 头可恢复

## 下一步

- 通过 Admin UI 恢复上游配置（OpenCode upstream + API key）
- 运行 proxy-diff 测试验证所有差异已消除
- 如有残留差异，根据新测试数据精确定位修复
- 可选：进一步对齐用户消息 content 格式、upstream 请求头（accept/user-agent 等）的细粒度差异
