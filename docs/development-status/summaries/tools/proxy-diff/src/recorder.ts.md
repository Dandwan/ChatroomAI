## 功能

记录器。初始化运行记录目录结构，将每个 session 的全部数据落盘。每个 session 保存 9 个文件（覆盖全部 6 个记录点）：

1. `user-request.json` — 原始用户输入
2. `dispatcher-cpa-outbound.json` / `dispatcher-actinet-outbound.json` — 发往 CPA/ActiNet 的完整 HTTP 请求
3. `cpa-upstream.json` / `actinet-upstream.json` — CPA/ActiNet 翻译后的上游请求
4. `real-upstream-response.json` — 真实上游完整响应（status+headers+body）
5. `upstream-to-cpa.json` / `upstream-to-actinet.json` — relay 回 CPA/ActiNet 的响应
6. `cpa-final.json` / `actinet-final.json` — CPA/ActiNet 翻译后的最终响应

最终生成 `run-record.json` 汇总和 `report.md` 对比报告。

## 关系

### 调用 / 引用

- `node:fs` — `writeFileSync`、`mkdirSync`
- `node:path` — `join`
- `types.ts` — `ProxyDiffConfig`、`PendingSession`、`RunRecord`、`DiffResult`
- `logger.ts` — `createLogger`

### 提供

- `initRecorder(config)` — 初始化运行记录
- `recordSession(session)` — 保存 session 的全部原始数据
- `finalizeRun(diffs)` — 写入 `run-record.json`
- `getOutputDir()` — 获取输出目录路径

### 被依赖

- `index.ts`
