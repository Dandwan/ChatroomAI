# `tools/proxy-diff/src/recorder.ts`

## 功能
测试记录器。初始化运行记录（按时间戳创建输出目录），将每个会话的原始数据（用户请求、CPA/ActiNet 上游事务、最终响应、真实上游响应）写入 JSON 文件。运行结束时生成 `run-record.json` 汇总文件。

## 关系
### 提供
- `initRecorder()` — 初始化记录器
- `recordSession()` — 记录单个会话
- `finalizeRun()` — 写入汇总记录
- `getOutputDir()` — 获取输出目录路径

### 被依赖
- `index.ts`
