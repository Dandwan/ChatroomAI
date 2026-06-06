## 功能

对比器。逐 session 比较 CPA 和 ActiNet 的翻译行为，分为 5 个阶段：

- **阶段 A**：端点对比 — CPA vs ActiNet 上游目标（method + path）
- **阶段 B**：上游请求体对比 — 翻译后的请求 body（JSON 结构化 diff 或纯文本 diff）
- **阶段 C**：最终响应体对比 — 翻译后的最终响应
- **阶段 D**：延迟对比 — CPA vs ActiNet 上游到达时间差
- **阶段 E**：错误汇总 — 各阶段 HTTP 错误状态

使用 `diff` 库的 `diffJson` 和 `diffWords` 进行结构化文本差异分析。

## 关系

### 调用 / 引用

- `diff` — `diffJson`、`diffWords`
- `types.ts` — `PendingSession`、`DiffResult`

### 提供

- `compareSession(session)` — 对比单个 session
- `compareAll(sessions)` — 批量对比

### 被依赖

- `index.ts`
