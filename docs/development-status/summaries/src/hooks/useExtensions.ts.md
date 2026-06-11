# `src/hooks/useExtensions.ts`

## 功能
扩展管理 hook。管理 skill 和 runtime 的安装、启用/禁用、删除、配置编辑和刷新。提取自 `src/App.tsx`。

## 关系
### 调用 / 引用
- `src/state/extensions-store.ts` — `useExtensionsStore`（skill/runtime 记录状态）
- `src/state/ui-store.ts` — `useUIStore`（导航）
- `src/services/skills/host.ts` — skill CRUD 函数
- `src/services/skills/runtime.ts` — runtime CRUD 函数
- `src/utils/app-formatting.ts` — `formatJsonObject`, `parseSkillConfigDraft`

### 提供
- `useExtensions` — 返回扩展状态和所有管理回调

### 被依赖
- `src/App.tsx` — 计划使用（待集成）

## 关键词
### 函数
- `useExtensions` — hook 主函数
- `refreshExtensions` — 刷新 skill/runtime 列表
- `handleSkillArchiveSelect` / `handleRuntimeArchiveSelect` — 安装扩展包
- `handleSetSkillEnabled` / `handleSetRuntimeEnabled` — 启用/禁用
- `deleteSkillById` / `deleteRuntimeById` — 删除
- `handleSetDefaultRuntime` / `handleTestRuntime` — 默认设置/检测
- `openSkillConfigEditor` / `saveSkillConfig` — 配置编辑
