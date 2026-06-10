# `src/utils/app-formatting.ts`

## 功能
通用格式化、类型检查和 ID 生成工具函数。包含日期/数字格式化、JSON 解析验证、设置值标准化等辅助函数。

从 `src/App.tsx` 模块级代码中提取。

## 关系
### 提供
- `isRecord`、`isJsonObjectRecord`、`formatJsonObject`、`parseSkillConfigDraft` — 类型检查与 JSON 处理
- `toFiniteNumber` — 数值标准化
- `createId` — UUID/随机 ID 生成
- `numberFormatter`、`dateFormatter`、`drawerGroupDateFormatter`、`drawerGroupTimeFormatter` — Intl 格式化器
- `startOfLocalDay`、`formatDrawerGroupLabel`、`formatCompactCount` — 日期/数字显示
- `getResponseModeLabel`、`buildHomepageModelTriggerLabel` — 响应模式标签

### 被依赖
- `src/utils/app-debug.ts` — 导入 `isRecord`
- `src/App.tsx` — （计划导入，当前仍使用内联定义）

## 关键词
### 函数
- `isRecord`、`isJsonObjectRecord`、`formatJsonObject`
- `parseSkillConfigDraft`、`toFiniteNumber`
- `createId`
- `formatCompactCount`、`formatDrawerGroupLabel`、`startOfLocalDay`
- `getResponseModeLabel`、`buildHomepageModelTriggerLabel`
