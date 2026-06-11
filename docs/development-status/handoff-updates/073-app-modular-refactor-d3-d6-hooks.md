# 073 — App.tsx 模块化重构 D3-D6：四个 hook 提取

**日期**：2026-06-11

## 范围

提取 4 个自定义 hooks（D3, D4, D5, D6）从 App.tsx，总计 ~900 行独立 hook 代码。

## 变更的代码区域

| 文件 | 状态 | 阶段 | 行数 |
|------|------|------|------|
| `src/hooks/useUpdates.ts` | ✅ 新建+已集成 | D5 | 83 |
| `src/hooks/usePermissions.ts` | ✅ 新建+已集成 | D6 | 94 |
| `src/hooks/useExtensions.ts` | ✅ 新建 | D4 | 416 |
| `src/hooks/useSettings.ts` | ✅ 新建 | D3 | 319 |
| `src/App.tsx` | ✅ 修改 | D5+D6 | 5,982 (−98) |

### D5: useUpdates hook
- 提取 `pendingUpdate`, `showUpdateDialog`, `updatingNow` 状态
- 提取 `handleInstallUpdate`, `handleManualUpdateCheck` handler
- 新增 `onUpdateFound` 回调（供 useCloudAuth 使用）
- 新增 `dismissUpdateDialog` 回调
- **已集成到 App.tsx**：删除了 45 行内联代码

### D6: usePermissions hook
- 提取 `handlePermissionToggle`（含动态 import）
- 提取 `requestingPermissionByKey` 状态
- **已集成到 App.tsx**：删除了 54 行内联代码

### D4: useExtensions hook
- 提取所有 skill/runtime 管理逻辑（~400 行）
- 包含：扩展安装、启用/禁用、删除、配置编辑、刷新、运行时检测
- 包含初始加载 useEffect
- **hook 文件已创建，编译通过，但尚未集成到 App.tsx**

### D3: useSettings hook
- 提取 settings 状态管理（~280 行）
- 包含：`applySettingsUpdate`, numeric handlers, provider CRUD
- 包含：model 选择, provider 配置编辑
- 包含计算属性：`activeProviderRequestSettings`, `providerDetailTarget`
- **hook 文件已创建，编译通过，但尚未集成到 App.tsx**

## App.tsx 集成经验教训

D5/D6 成功集成的模式：小型、独立 handler hook（<100 行），通过 Zustand stores 共享状态。

D3/D4 集成失败的原因：hook 提取的函数在渲染代码中有大量引用（`renderProviderDetailSettings` 等内联渲染函数直接引用 `handleNumericSettingChange(newValue)` 等形式）。简单全局替换会破坏 JSX prop 名称。

### 建议的 D3/D4 集成方法
1. 在 App.tsx 中添加 hook 调用：`const set = useSettings(pushNotice, openDeleteDialog)`
2. 手动替换每个渲染函数中的引用：`handleNumericSettingChange(...)` → `set.handleNumericSettingChange(...)`
3. 每次替换后编译验证
4. 移除对应内联函数定义
5. 删除已失效的 store selector（settingsStore, uiStore）

## 验证

- **tsc**：所有 4 个 hook 独立编译通过（仅保留 8 个预存 TS2304/TS2552 错误）
- **build**：runtime-shell 缺失（预存问题）
- **test**：39 通过，1 E2E 预存失败
- **App.tsx**：5,982 行（目标 ~400 行）

## 决策关卡

- 方案已提出：是（070-app-modular-refactor-completion-plan.md）
- 用户确认已收到：是

## 提交

```
ee5464b D5+D6: 提取 useUpdates 和 usePermissions hooks
4edfbe8 D4: 创建 useExtensions hook（~400 行）
1ef513d D3: 创建 useSettings hook（~280 行）
```

## 已知失败 / 跳过的检查

- D3, D4 hook 未完成 App.tsx 集成（仅创建了 hook 文件）
- D1 useConversation 未开始（骨架 hook 仍为 22 行规划文件）

## 待解决问题 / 风险

1. **D1 useConversation 是最大最难的提取**（~500 行）：涉及对话 CRUD、水合、持久化 useEffect、图片水合、手势 handler、生命周期 effects，深度依赖 App.tsx 中的其他函数
2. **D3/D4 集成**需要手动更新 ~30 处渲染函数引用
3. **阶段 E（views 提取）**依赖所有 hooks 就位后才能开始
4. **预存的 8 个 tsc 错误**仍未修复（removePendingImage 等）

## 下一步

1. **D4b**：集成 useExtensions 到 App.tsx（手动替换引用）
2. **D3b**：集成 useSettings 到 App.tsx（手动替换引用）
3. **D1**：提取 useConversation hook（最复杂）
4. **E**：提取渲染函数到 views/
5. **F**：最终精简 App.tsx + 更新文档摘要
