# 044 — 代理层重构：Thinking 子系统 + 签名清洗 + 智能直通 + Responses API

**日期**：2026-06-06

## 范围

基于与 CLIProxyAPI 的详细差距分析，对 cloud-server 代理层进行系统性重构和功能补全。分 3 个阶段实施：

**Phase 1: 基础（模型注册表 + Thinking 提取）**
- 新建 `model-registry.ts` — 中央模型能力注册表
- 新建 `thinking.ts` — 统一 Thinking 子系统
- 重构 `format-converter.ts` — 移除内联 thinking 逻辑
- 增强 `format-gemini.ts` — 添加 thinkingConfig 支持

**Phase 2: 智能直通（性能优化）**
- 新建 `smart-router.ts` — 同格式上游直通决策
- 新建 `transformer-cache.ts` — TransformStream 配置缓存
- 修改 `request-forwarder.ts` — `skipTransformers` 标志
- 修改 `proxy-routes.ts` — 接入智能路由

**Phase 3: 功能补全**
- 新建 `signatures.ts` — 跨 provider 签名清洗
- 新建 `responses-api.ts` — OpenAI Responses API 支持
- 修改 `proxy-routes.ts` — 接入签名清洗 + Responses API 路由

## 变更的代码区域

### 新建文件（6 个）
| 文件 | 行数 | 职责 |
|------|------|------|
| `cloud-server/src/proxy/model-registry.ts` | ~210 | 中央模型注册表，定义已知模型能力（Claude 4.x/3.x, GPT-5/4o/o3/o4, Gemini 3/2.5/2.0/1.5, DeepSeek），未知模型名启发式 fallback |
| `cloud-server/src/proxy/thinking.ts` | ~320 | Thinking 子系统：suffix 解析、Level↔Budget 双向映射、per-provider 配置提取/应用、统一 `processThinking()` 管道 |
| `cloud-server/src/proxy/smart-router.ts` | ~75 | 同格式直通决策矩阵（3×3）。Anthropic→Anthropic / Gemini→Gemini 直通跳过全部格式转换 |
| `cloud-server/src/proxy/signatures.ts` | ~210 | 跨 provider 签名清洗：strip thinking blocks、签名剥离、reasoning_content 删除 |
| `cloud-server/src/proxy/responses-api.ts` | ~330 | OpenAI Responses API ↔ Chat Completions 双向翻译 + SSE 流式转换 |
| `cloud-server/src/proxy/transformer-cache.ts` | ~80 | LRU 缓存追踪 TransformStream 构造配置（非实例） |

### 修改文件（5 个）
| 文件 | 变化 |
|------|------|
| `cloud-server/src/types.ts` | 新增 `ThinkingCapability`、`ThinkingLevel`、`ModelInfo`、`PassthroughPlan`、`SignaturePolicy` 等 7 个接口/类型 |
| `cloud-server/src/proxy/format-converter.ts` | 移除 L7-56 内联 thinking 代码，委托给 `thinking.ts`；导入改为从 `thinking.ts` |
| `cloud-server/src/proxy/format-gemini.ts` | `openaiToGeminiRequest` 和 `geminiToOpenaiRequest` 新增 thinking 支持 |
| `cloud-server/src/proxy/request-forwarder.ts` | `StreamForwardOptions` 新增 `skipTransformers` 标志 |
| `cloud-server/src/proxy/proxy-routes.ts` | `ForwardChatOptions` 新增 `clientApiType`；接入 smart-router 直通逻辑；接入签名清洗；新增 `POST /v1/responses` 端点 |

## 设计决策

1. **星型枢纽 + 智能直通（非 N×M 矩阵）**：避免 CPA 的 O(N×M) 维护负担，同格式路径性能达到最优
2. **Thinking 抽取为独立子系统**：供 `format-converter.ts`、`format-gemini.ts`、`responses-api.ts` 共享
3. **模型注册表静态优先 + 启发式 fallback**：已知模型有准确的能力定义，未知模型通过名称模式匹配
4. **签名清洗保守策略**：仅 strip 不兼容字段，不尝试跨格式转换（避免引入新错误）
5. **Responses API 通过星型枢纽实现**：转换到 Chat Completions → 转发 → 转换回 Responses 格式
6. **TransformStream 缓存仅追踪配置**：不缓存实例（不可复用），避免冗余模型能力查询

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- 新建文件：6 个（~1,225 行）
- 修改文件：5 个（净变化 ~370 行）
- 删除代码：~190 行（从 format-converter.ts 移除的内联 thinking 逻辑）
- 代码摘要：新建 6 个 + 更新 5 个

## 决策关卡

- 方案已提出：是（含 3 Phase 详细工程方案、组件交互图、智能路由决策矩阵）
- 用户确认已收到：是

## 已知限制

1. 模型注册表仅覆盖主流模型（~30 个），新模型通过启发式处理
2. 签名清洗仅处理 thinking/签名，不处理 tool_use 高级签名
3. Responses API 不支持 WebSocket 模式
4. Gemini safetySettings 透传但不变换
5. 智能直通优化仅对同格式路径生效（3/9 种格式配对）
6. 未包含 Admin UI 更新（Responses API 上游类型选择等）

## 下一步

- 部署到云服务器验证所有端点
- 用 Claude Code 连接 Anthropic 端点测试同格式直通
- 用 OpenAI SDK 测试 `POST /v1/responses` 端点
- 观察生产日志中签名清洗和智能直通的触发频率
- 可选：扩展模型注册表支持动态模型发现
- 可选：为 Gemini safetySettings 添加跨格式映射
- 可选：Admin UI 添加 Responses API 上游类型
