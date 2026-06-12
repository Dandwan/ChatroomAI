# 085 — 修复：未开启高级模型时找不到快速和专家模型

**日期**：2026-06-12
**类型**：Bug 修复

## 问题

用户在未开启"高级模型"开关（`actiNetAdvancedModelsEnabled: false`）时，找不到"快速"和"专家"两个 ActiNet 核心模型。

## 根因

1. `getVisibleActiNetModels(advancedMode)` 函数（`actinet-models.ts:120`）已正确定义——当 `advancedMode=false` 时返回仅核心模型（快速、专家），但该函数**从未被任何代码调用**
2. 所有模型可见性路径（`getEnabledModelOptions`、`enabledModelsByProvider`、`ensureValidCurrentModelSelection`）都使用 `getEffectiveActiNetModels()`，该函数忽略高级模型开关
3. `ActiNetSettings.tsx` 使用 `{actiNetAdvancedModelsEnabled && (` 将整个模型管理区域条件隐藏，开关关闭后用户在设置中也看不到任何模型
4. `useAssistant.ts` 中有完全重复的 `getEnabledModelOptions` 实现，同样未使用 `getVisibleActiNetModels`

## 变更的代码区域

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/utils/app-module.ts` | 修改 | 导入 `getVisibleActiNetModels`；`getEnabledModelOptions` 新增第四参数 `actiNetAdvancedModelsEnabled`，改用 `getVisibleActiNetModels()`；`ensureValidCurrentModelSelection` 改用 `getVisibleActiNetModels()` |
| `src/App.tsx` | 修改 | 导入 `getVisibleActiNetModels`；`enabledModelOptions` 和 `enabledModelsByProvider` memo 追加依赖项和参数；`enabledModelsByProvider` 改用 `getVisibleActiNetModels()` |
| `src/hooks/useAssistant.ts` | 修改 | 删除本地重复的 `getEnabledModelOptions`（−31 行）和 `ACTINET_PROVIDER_ID`/`ACTINET_PROVIDER_NAME` 常量（−2 行），改为从 `app-module.ts` 导入共享版本；更新调用点新增参数 |
| `src/components/settings/ActiNetSettings.tsx` | 修改 | UI 重构：导入 `getVisibleActiNetModels`，新增 `visibleModels`；移除模型管理区域的 `{actiNetAdvancedModelsEnabled && (` 外层保护，改为始终显示核心模型列表和摘要，仅条件隐藏拉取/添加/搜索等高级功能 |
| `src/views/SettingsPage.tsx` | 修改 | `getEnabledModelOptions` 调用追加第四参数 |

### 修改的摘要文件

| 文件 | 操作 |
|------|------|
| `docs/development-status/summaries/src/utils/app-module.ts.md` | **新建** |
| `docs/development-status/summaries/src/App.tsx.md` | 更新（新增 ActiNet 模型可见性修复记录） |
| `docs/development-status/summaries/src/hooks/useAssistant.ts.md` | 更新（去重 + 新导入记录） |
| `docs/development-status/summaries/src/components/settings/ActiNetSettings.tsx.md` | 更新（UI 重构记录） |
| `docs/development-status/summaries/src/services/actinet-models.ts.md` | 更新（新增 `getVisibleActiNetModels`、`CORE_ACTINET_MODEL_IDS` 和新的被依赖关系） |

### 不修改的文件

| 文件 | 原因 |
|------|------|
| `src/services/actinet-models.ts` | `getVisibleActiNetModels` 已正确实现，无需修改 |
| `src/views/ChatView.tsx` | `resolveEmptyResponseProvider` 是模型识别（非可见性过滤），需用全量列表 |
| `src/hooks/useSettings.ts` | `selectCurrentModel` 做模型存在性验证，需用全量列表 |
| `src/state/types.ts` | `actiNetAdvancedModelsEnabled` 已存在于 `AppSettings` |

## 设计决策

1. **服务函数 vs 可见性函数分离**：`resolveProviderRequestSettings` 和 `resolveEmptyResponseProvider` 是服务/识别函数，需用 `getEffectiveActiNetModels()`（全量列表），不修改。只有 UI 可见性过滤路径使用 `getVisibleActiNetModels()`
2. **开关 OFF 时设置页体验**：始终显示核心模型（快速、专家）及启用/禁用切换，仅隐藏拉取/添加/搜索等高级管理功能
3. **去重**：`useAssistant.ts` 中的 `getEnabledModelOptions` 完全重复 `app-module.ts` 的实现，本次一并删除并导入共享版本（减少技术债务）
4. **存量模型保留**：非核心模型在 storage 中保留，开关重新打开后自动恢复可见

## 预期行为

| 场景 | 开关 OFF | 开关 ON |
|------|---------|---------|
| 聊天模型选择器 | 仅显示 快速/专家（已启用的） | 显示全部已启用模型 |
| 设置页模型列表 | 仅显示 快速/专家 + 启用开关 | 全部模型 + 拉取/添加/搜索 |
| 拉取/添加/搜索 | 隐藏 | 显示 |
| "高级模型"开关 | 显示，可开启 | 显示，可关闭 |

## 验证

```bash
npx tsc -b --noEmit   # 0 错误 ✅
npm run build          # ✓ built in 297ms ✅
npx vitest run         # 39 passed ✅（1 e2e 预存失败无关）
```

## 决策关卡

- 方案与确认关卡已完成：是

## 未解决问题

- P4 Issue #6：跨模块重复函数统一（`useConversation.ts` ↔ `useAssistant.ts`，4 个函数）— 已知技术债务，不在本次修复范围

## 关联文档

- 前一更新：`084-fix-blue-screen-null-check-crash.md`
- 相关功能：`032-other-providers-default-off.md`
- 当前状态：`30-current-state-and-known-issues.md`
