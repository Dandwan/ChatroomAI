## 功能

报告生成器。生成终端彩色输出和 Markdown 文件格式的对比报告。终端报告包含：端点对比、请求体 diff、响应体 diff、延迟统计、错误汇总。Markdown 报告额外包含 dispatcher outbound、real upstream response、relay response 等完整记录。

## 关系

### 调用 / 引用

- `node:fs` — `writeFileSync`
- `node:path` — `join`
- `types.ts` — `DiffResult`、`RunRecord`

### 提供

- `printConsoleReport(diffs)` — 终端报告
- `writeMarkdownReport(runRecord, outputDir)` — Markdown 文件报告

### 被依赖

- `index.ts`
