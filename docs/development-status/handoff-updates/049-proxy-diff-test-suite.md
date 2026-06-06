# 049 — Proxy Diff 测试套件：CPA vs ActiNet 翻译行为对比

**日期**：2026-06-06

## 范围

新建 `tools/proxy-diff/` — CPA vs ActiNet 代理翻译行为对比测试套件。从丢失的源码重建完整 TypeScript 项目，并增强全链路记录能力。

### 核心能力

- 接受用户输入（JSON 文件或 stdin），记录原始请求
- 原封不动并发发送至 CPA（:8080）和 ActiNet（:3000）
- 内置通配上游模拟器（:9000），捕获 CPA/ActiNet 翻译后的上游请求（method/path/headers/body，零格式假设）
- 通过 mihomo 代理将其中一方的请求转发至真实上游（可配置 --forward-source cpa|actinet）
- 真实上游响应原封不动 relay 给 CPA 和 ActiNet
- 记录全部 9 个数据点/session（6 个记录点，覆盖所有 hop）
- 逐阶段对比：端点、请求体、响应体、延迟、错误

## 流程图

```mermaid
flowchart TD
    U[👤 用户输入<br/>JSON 文件 / stdin] -->|记录点1: user-request.json| D[📤 request-dispatcher<br/>并发发送至 CPA + ActiNet]

    D -->|记录点2a: dispatcher-cpa-outbound.json<br/>完整 HTTP 请求原文| CPA[🧠 CPA<br/>:8080]
    D -->|记录点2b: dispatcher-actinet-outbound.json<br/>完整 HTTP 请求原文| ACT[🧠 ActiNet<br/>:3000]

    CPA -->|"翻译请求 → 转发到配置的上游"| SIM
    ACT -->|"翻译请求 → 转发到配置的上游"| SIM

    SIM[📡 upstream-simulator :9000<br/>通配 HTTP 服务器<br/>捕获 method/path/headers/body<br/>零格式假设] -->|记录点3a: cpa-upstream.json| CPA_TX[CPA 翻译后的上游请求]
    SIM -->|记录点3b: actinet-upstream.json| ACT_TX[ActiNet 翻译后的上游请求]

    CPA_TX --> CHOICE{forwardSource<br/>cpa | actinet}
    ACT_TX --> CHOICE

    CHOICE -->|"选择一方，原封不动转发"| PF[🔀 proxy-forwarder<br/>通过 mihomo 代理]

    PF --> RU[🌐 Real Upstream<br/>api.openai.com 等]
    RU -->|记录点4: real-upstream-response.json<br/>status + headers + body 完整原始响应| RELAY

    RELAY[📡 upstream-simulator<br/>原封不动 relay] -->|记录点5a: upstream-to-cpa.json| CPA_R[relay 给 CPA]
    RELAY -->|记录点5b: upstream-to-actinet.json| ACT_R[relay 给 ActiNet]

    CPA_R --> CPA2[🧠 CPA 翻译回复]
    ACT_R --> ACT2[🧠 ActiNet 翻译回复]

    CPA2 -->|记录点6a: cpa-final.json| COMP
    ACT2 -->|记录点6b: actinet-final.json| COMP

    COMP[🔍 comparator<br/>5 阶段对比] --> REP[📊 reporter<br/>终端 + Markdown 报告]

    style SIM fill:#4a90d9,color:#fff
    style CHOICE fill:#e8a838,color:#000
    style COMP fill:#50b86c,color:#fff
    style REP fill:#50b86c,color:#fff
```

### 记录点清单

| # | 文件名 | 内容 | 阶段 |
|---|--------|------|------|
| 1 | `{sess}-user-request.json` | 用户原始输入（method, path, headers, body） | 输入 |
| 2a | `{sess}-dispatcher-cpa-outbound.json` | 发往 CPA 的完整 HTTP 请求（url, method, headers, body） | Dispatcher→CPA |
| 2b | `{sess}-dispatcher-actinet-outbound.json` | 发往 ActiNet 的完整 HTTP 请求 | Dispatcher→ActiNet |
| 3a | `{sess}-cpa-upstream.json` | CPA 翻译后的上游请求（method, path, headers, body） | CPA→Upstream |
| 3b | `{sess}-actinet-upstream.json` | ActiNet 翻译后的上游请求 | ActiNet→Upstream |
| 4 | `{sess}-real-upstream-response.json` | 真实上游完整响应（status, headers, body） | Upstream 真实响应 |
| 5a | `{sess}-upstream-to-cpa.json` | relay 给 CPA 的响应（status, headers, body） | Upstream→CPA |
| 5b | `{sess}-upstream-to-actinet.json` | relay 给 ActiNet 的响应 | Upstream→ActiNet |
| 6a | `{sess}-cpa-final.json` | CPA 翻译后的最终响应 | CPA→用户 |
| 6b | `{sess}-actinet-final.json` | ActiNet 翻译后的最终响应 | ActiNet→用户 |

### Comparator 5 阶段

| 阶段 | 对比内容 | 方法 |
|------|---------|------|
| A — 端点对比 | CPA vs ActiNet 上游目标 method + path | 字符串相等 |
| B — 请求体对比 | 翻译后的上游请求 body | JSON 结构化 diff（`diffJson`），fallback 纯文本 diff（`diffWords`） |
| C — 响应体对比 | 翻译后的最终响应 body | 同上 |
| D — 延迟对比 | CPA vs ActiNet 上游到达时间差 | 毫秒差 |
| E — 错误汇总 | 各阶段 HTTP 错误状态（≥400） | 收集所有错误消息 |

## 变更的代码区域

### 新建文件（16 个）

**TypeScript 源码（10 个）**：`tools/proxy-diff/src/`

| 文件 | 行数 | 职责 |
|------|------|------|
| `types.ts` | ~150 | 全链路数据类型：UserRequest → DiffResult，6 个记录点数据结构 |
| `config.ts` | ~60 | JSON 配置加载 + 合并（默认 → 用户文件 → CLI 覆盖） |
| `logger.ts` | ~18 | 模块化日志（debug/info/warn/error + [module] 前缀） |
| `upstream-simulator.ts` | ~250 | Express 通配服务器 + SessionRegistry 会话匹配 + relay 逻辑 |
| `request-dispatcher.ts` | ~120 | 并发分发至 CPA/ActiNet，记录出站请求 + 最终响应 |
| `proxy-forwarder.ts` | ~90 | 通过 undici ProxyAgent + mihomo 转发至真实上游 |
| `recorder.ts` | ~130 | 9 文件/session 落盘 + run-record.json 汇总 |
| `comparator.ts` | ~170 | 5 阶段结构化对比（端点/请求体/响应体/延迟/错误） |
| `reporter.ts` | ~200 | 终端彩色报告 + Markdown 文件报告 |
| `index.ts` | ~150 | CLI 入口（commander），编排完整生命周期 |

**项目配置（3 个）**：
- `package.json` — ESM 包配置，4 个运行时依赖 + 4 个 dev 依赖
- `tsconfig.json` — ES2022/NodeNext/strict
- `proxy-diff.config.json` — 默认配置（CPA :8080, ActiNet :3000, mihomo :7890, test :9000）

**测试夹具（2 个）**：
- `fixtures/openai-basic.json` — OpenAI Chat Completions 格式
- `fixtures/anthropic-basic.json` — Anthropic Messages 格式

## 设计决策

### 1. 接口无关性 — 核心设计原则

**所有 body 使用原始字符串**（`body: string`），永不解析。这确保：
- OpenAI Chat Completions、Anthropic Messages、Gemini generateContent、以及任何未知 API 格式都能正确记录
- 转发时原封不动还原，不引入格式转换偏差
- 对比时始终保持原始内容完整性

### 2. 全链路 9 点记录

相比初版（仅记录 5 个点），增强为 9 个文件/session：
- **新增 Dispatcher Outbound**（记录点 2a/2b）：完整 HTTP 请求原文（含目标 URL），用于验证 dispatcher 是否正确发送
- **增强 Real Upstream Response**（记录点 4）：从仅 body 变为 status + headers + body 完整响应
- **新增 Relay Response**（记录点 5a/5b）：替代 Express Response 对象引用（不可序列化），显式保存 relay 给 CPA/ActiNet 的响应

### 3. SessionRegistry 单槽模型

使用 per-source 单槽匹配（CPA 槽 + ActiNet 槽），而非自定义 HTTP 头传递 session ID。原因：
- CPA/ActiNet 可能不转发自定义头
- 同时只运行一个测试会话，单槽模型足够

### 4. 并发 Dispatch

使用 `Promise.all` 并发发送至 CPA 和 ActiNet（而非串行），因为 upstream-simulator 内部处理双方的到达顺序无关问题（先到先挂起，等到齐后 relay）。

### 5. 一方选择性转发

`--forward-source cpa|actinet` 选择将哪一方的翻译请求发送到真实上游。非选择方的翻译请求仅被记录但不转发。这确保：
- 真实上游只收到一个请求
- 双方收到相同的上游响应（来自同一方）
- 对比的是翻译行为的差异，而非上游响应的差异

## 验证

- `npx tsc --noEmit` — **零错误**
- `npx tsc` — 编译成功，生成 10 个 JS 模块 + 声明文件 + source maps
- `node dist/index.js --help` — CLI 正常输出
- 代码摘要：新建 13 个（10 源码 + 3 配置）

## 决策关卡

- 方案已提出：是（含 2 轮方案细化：初版 + 全链路记录增强）
- 用户确认已收到：是

## 已知限制

1. **SSE 流式**：`express.text()` 缓冲整个 body，适用于非流式请求。流式 SSE 的精确逐块录制需要后续增强（使用 TransformStream 管道）
2. **单会话模型**：同时只支持一个测试会话。多会话并发需要扩展 SessionRegistry
3. **Express Response 追踪**：当前通过临时 `_cpaRes`/`_actiRes` 字段追踪连接（非类型安全），后续可重构为显式的 per-source Response Map
4. **仅非流式对比**：当前不支持流式 SSE chunk-by-chunk 对比

## 下一步

- 部署 CPA 和 ActiNet 实例后运行端到端测试
- 分别用 `--forward-source cpa` 和 `--forward-source actinet` 对比结果
- 可选：添加 SSE 流式支持（TransformStream 管道录制）
- 可选：添加多会话并发支持
- 可选：添加 `.gitignore`（outputs/、proxy-diff.config.local.json）
