# `tools/proxy-diff/src/reporter.ts`

## 功能
报告生成器。提供终端彩色对比报告（`printConsoleReport`）和 Markdown 报告文件生成（`writeMarkdownReport`）。报告包含端点对比、请求体 diff、响应体 diff、延迟对比和错误汇总。

## 关系
### 调用 / 引用
- `types.ts` — `DiffResult`, `RunRecord`

### 提供
- `printConsoleReport()` — 终端报告
- `writeMarkdownReport()` — Markdown 文件报告

### 被依赖
- `index.ts`
