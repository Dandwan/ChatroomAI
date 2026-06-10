# `src/hooks/useAssistant.ts`

## 功能
助手交互 hook 的提取规划文件。记录了从 App.tsx 提取 `executeAssistantTurn`、`handleSend`、`handleAppend` 等核心助手交互函数的详细边界、行号和依赖清单。

当前状态：planned（已建立提取规划，等待实现）。

## 关系
### 调用 / 引用
- `src/state/chat-store.ts` — 计划导入
- `src/state/ui-store.ts` — 计划导入
- `src/state/settings-store.ts` — 计划导入
- `src/services/chat-api.ts` — 计划导入
- `src/services/chat-transcript/` — 计划导入
- `src/services/skills/` — 计划导入

### 被依赖
- `src/App.tsx` — 计划使用（当前 App.tsx 内联包含此处记录的函数）

## 关键词
### 常量
- `USE_ASSISTANT_EXTRACTION_PLAN` — 提取规划元数据
