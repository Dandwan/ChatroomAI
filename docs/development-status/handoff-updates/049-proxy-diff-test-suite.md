# 049 — CPA vs ActiNet 代理翻译行为对比测试套件

**日期**：2026-06-06

## 范围

新建 `tools/proxy-diff/` — 一个独立的 Node.js/TypeScript 测试工具，用于对比 CPA (CLIProxyAPI) 和 ActiNet (本项目 cloud-server) 在相同输入下的 API 代理翻译行为差异。

## 核心设计

测试套件通过"上游模拟器"模式工作：
1. CPA 和 ActiNet 的上游 URL 配置为指向测试套件的上游模拟器（`ALL *` 通配 HTTP Server）
2. 用户提供任意 HTTP 请求描述（method + path + headers + body JSON 文件）
3. 测试套件同时发送到 CPA 和 ActiNet
4. 两者翻译请求后转发给上游模拟器，模拟器原样记录 HTTP 事务后挂起响应
5. 当两侧都到达后，选择一个（可配置）通过 mihomo 代理原样转发给真实上游
6. 真实上游响应 relay 回 CPA 和 ActiNet，它们翻译回用户格式
7. 对比分析四个层面：端点选择、请求体差异、响应体差异、延迟性能

## 文件

### 新建（10 源文件 + 4 fixtures + 配置）
```
tools/proxy-diff/
├── package.json                        # ESM 项目，依赖 express/undici/chalk/commander/diff
├── tsconfig.json                       # ESM + Node.js target
├── .gitignore
├── proxy-diff.config.json              # 默认配置模板
├── src/
│   ├── index.ts                        # CLI 入口（commander）
│   ├── config.ts                       # 配置加载（JSON 文件 + 默认值合并）
│   ├── types.ts                        # 共享类型（UserRequest, CapturedHttpTransaction, PendingSession 等）
│   ├── logger.ts                       # 轻量日志模块
│   ├── upstream-simulator.ts           # ★ 核心：通配 HTTP 透传 Server + SessionRegistry
│   ├── request-dispatcher.ts           # HTTP 客户端：并发发送到 CPA 和 ActiNet
│   ├── proxy-forwarder.ts              # 通过 undici ProxyAgent + mihomo 转发到真实上游
│   ├── recorder.ts                     # 请求/响应记录器（内存 + JSON 文件）
│   ├── comparator.ts                   # 对比分析器（diffJson/diffWords）
│   └── reporter.ts                     # 报告生成器（终端 + Markdown）
└── fixtures/
    ├── openai-basic.json               # OpenAI Chat Completions 基础请求
    ├── anthropic-basic.json             # Anthropic Messages 基础请求
    ├── gemini-basic.json                # Gemini generateContent 基础请求
    └── openai-with-tools.json           # OpenAI + function calling 请求
```

### 摘要
```
docs/development-status/summaries/tools/proxy-diff/src/
├── types.ts.md
├── config.ts.md
├── logger.ts.md
├── upstream-simulator.ts.md
├── request-dispatcher.ts.md
├── proxy-forwarder.ts.md
├── recorder.ts.md
├── comparator.ts.md
├── reporter.ts.md
└── index.ts.md
```

## 决策关卡

- 方案已提出：是（含完整数据流图、组件架构、通配 HTTP 透传设计）
- 用户确认已收到：是
- 用户反馈：强调上游模拟器必须是自适应接口（通配路由），记录 CPA/ActiNet 调用的端点并按相同端点转发

## 关键设计决策

1. **通配 HTTP 透传 (`ALL *`) vs 格式特定路由**：选择通配路由，不对 CPA/ActiNet 的上游请求体做任何格式假设。无论它们发送 OpenAI、Anthropic、Gemini 还是未知格式，一律原样记录和转发。

2. **SessionRegistry 顺序匹配 vs 自定义 Header**：选择按发送顺序匹配（单槽位 per-source），因为无法保证 CPA/ActiNet 会转发自定义 HTTP header。

3. **undici ProxyAgent vs 全局 fetch**：使用 undici 的 `fetch` + `ProxyAgent`，因为 Node.js 全局 `fetch` 不支持 `dispatcher` 选项（无法配置 HTTP 代理）。

4. **同步上游响应 relay**：选择 CPA 和 ActiNet 同时拿到真实上游的同一份响应，确保对比结果不受上游响应差异影响。

## 验证

- `npx tsc --noEmit` — 零错误
- `npx tsc -p tsconfig.json` — 构建成功（dist/ 输出）
- 创建的 fixtures 覆盖 OpenAI、Anthropic、Gemini 三种格式

## 已知限制

1. WebSocket 模式未覆盖（CPA 和 ActiNet WS 实现差异较大）
2. 单会话串行模式（通过顺序匹配关联请求）
3. SSE 流式事件的逐事件 diff 尚不支持（仅对比完整响应体）
4. 需手动启动 CPA、ActiNet、mihomo 后再运行测试套件

## 下一步

- 用真实 CPA + ActiNet 实例运行端到端对比测试
- 添加流式 SSE 事件级别对比
- 可选：支持批量 fixtures 自动执行
