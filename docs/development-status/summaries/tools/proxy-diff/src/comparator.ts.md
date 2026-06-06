# `tools/proxy-diff/src/comparator.ts`

## 功能
CPA vs ActiNet 对比分析器。对每个会话进行四个层面的对比：(1) 上游调用端点差异（method + path），(2) 上游请求体差异（JSON diff），(3) 最终用户响应体差异，(4) 延迟和错误对比。使用 `diff` 库进行结构化 JSON diff。

## 关系
### 调用 / 引用
- `types.ts` — `PendingSession`, `DiffResult`
- `diff` — `diffJson`, `diffWords`

### 提供
- `compareSession()` — 对比单个会话
- `compareAll()` — 批量对比

### 被依赖
- `index.ts`
