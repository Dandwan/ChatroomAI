# `src/utils/app-debug.ts`

## 功能
调试日志工具函数集合。提供 skill 回合日志和对象流日志的读写、清理、导出功能，以及提示词消息的调试截断。

从 `src/App.tsx` 模块级代码中提取。

## 关系
### 调用 / 引用
- `src/utils/app-formatting.ts` — 导入 `isRecord`

### 提供
- `DEBUG_SKILL_ROUND_LOG_STORAGE_KEY`、`DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY`、`DEBUG_LOG_ENTRY_LIMIT`、`DEBUG_LOG_TEXT_LIMIT`
- `truncateDebugLogText` — 文本截断
- `readDebugLogEntries` — 读取调试日志条目
- `appendDebugLogEntry` — 追加调试日志
- `clearDebugLogEntries` — 清除调试日志
- `buildDebugLogReportText` — 构建调试日志报告
- `normalizePromptMessagesForDebug` — 标准化调试用的提示词消息

### 被依赖
- `src/App.tsx` — 导入 debug 常量和工具函数

## 关键词
### 常量
- `DEBUG_SKILL_ROUND_LOG_STORAGE_KEY`
- `DEBUG_OBJECT_FLOW_LOG_STORAGE_KEY`
- `DEBUG_LOG_ENTRY_LIMIT`
- `DEBUG_LOG_TEXT_LIMIT`

### 函数
- `truncateDebugLogText`
- `readDebugLogEntries`
- `appendDebugLogEntry`
- `clearDebugLogEntries`
- `buildDebugLogReportText`
- `normalizePromptMessagesForDebug`
