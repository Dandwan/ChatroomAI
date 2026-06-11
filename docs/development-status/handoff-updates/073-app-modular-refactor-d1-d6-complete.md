# 073 — App.tsx 模块化重构 D1-D6：5 个 hooks 全部提取完成

**日期**：2026-06-11
**任务**：提取全部 5 个 hooks（D1, D3, D4, D5, D6），总计 ~1,600 行独立 hook 代码

## 范围

从 App.tsx 提取 5 个自定义 hooks，将 6,080 行的单体组件精简化。

## 变更的代码区域

| 文件 | 操作 | 阶段 | 行数 | 已集成？ |
|------|------|------|------|---------|
| `src/hooks/useConversation.ts` | ✅ 新建 | D1 | 470 | ❌ 待集成 |
| `src/hooks/useSettings.ts` | ✅ 新建 | D3 | 319 | ❌ 待集成 |
| `src/hooks/useExtensions.ts` | ✅ 新建 | D4 | 416 | ❌ 待集成 |
| `src/hooks/useUpdates.ts` | ✅ 新建 | D5 | 83 | ✅ 已集成 |
| `src/hooks/usePermissions.ts` | ✅ 新建 | D6 | 94 | ✅ 已集成 |
| `src/App.tsx` | ✅ 修改 | D5+D6 | 5,982 | −98 行 |

## 各 hook 完成情况

### D1: useConversation（470 行）
- **状态**：✅ 编译零错误
- **内容**：对话 CRUD（create/switch/delete）、水合、持久化 effect、图片水合 effect、标题编辑、手势 handler（pointer down/move/up/cancel）、对话分组、主页统计
- **集成难度**：高。需更新 ~30 处渲染函数引用

### D3: useSettings（319 行）
- **状态**：✅ 编译零错误
- **内容**：applySettingsUpdate、numeric handlers、provider CRUD、model 管理、计算属性
- **集成难度**：中。需更新 ~20 处渲染函数引用

### D4: useExtensions（416 行）
- **状态**：✅ 编译零错误
- **内容**：skill/runtime 管理（安装、启用/禁用、删除、配置编辑）、刷新逻辑
- **集成难度**：中。需更新 ~15 处渲染函数引用

### D5: useUpdates（83 行）
- **状态**：✅ 已集成
- **内容**：APK 更新检查/安装、下载逻辑

### D6: usePermissions（94 行）
- **状态**：✅ 已集成
- **内容**：原生权限请求（位置、相机、麦克风、通知）

## 集成经验总结

**成功模式**（D5/D6）：小型独立 handler hook（<100 行），返回状态+回调，在 App.tsx 中用 `const x = useXxx()` 替换内联代码。效果：2 个 hook 共减少 98 行。

**待完成模式**（D1/D3/D4）：大 hook 创建后，需要在 App.tsx 中手动更新渲染函数引用（如 `renderProviderDetailSettings` 内直接调用 `handleNumericSettingChange(newValue)` 需改为 `set.handleNumericSettingChange(newValue)`）。自动全局替换会破坏 JSX prop 名称。

### 推荐集成步骤
1. 在 App.tsx 导入区添加对应 hook import
2. 在 App() 内添加 hook 调用
3. 逐个查找渲染函数中的内联变量引用，改为 `hook.xxx`
4. 每次改动后 `npx tsc -b --noEmit` 验证
5. 删除对应的内联 store selectors 和函数定义
6. 删除无效的 `void xxx;` 引用

## 验证

- **tsc**：所有 5 个 hook 独立编译零错误（仅保留 8 个预存错误）
- **build**：runtime-shell 缺失（预存）
- **test**：39 通过，1 E2E 预存失败
- **App.tsx**：5,982 行（从 7,576 减少 1,594 行，−21%）

## 决策关卡

- 方案已提出：是（070 完成方案）
- 用户确认已收到：是

## 提交

```
d774d4a D1: 创建 useConversation hook（~470 行）
1ef513d D3: 创建 useSettings hook（~280 行）
4edfbe8 D4: 创建 useExtensions hook（~400 行）
ee5464b D5+D6: 提取 useUpdates 和 usePermissions hooks
```

## 已知失败 / 跳过的检查

- D1, D3, D4 hook 仅创建文件，未完成 App.tsx 集成
- 阶段 E（views 提取）未开始
- 阶段 F（最终精简）未开始

## 待解决问题 / 风险

1. **D1 集成风险**：useConversation 包含 10 个 useEffect，需确认在 hook 内运行时机与原代码一致
2. **渲染函数耦合**：15+ 个内联渲染函数直接引用内联变量，需逐个替换为 hook 值
3. **预存 tsc 错误**：8 个 TS2304/TS2552 错误仍存在

## 下一步

1. **D1b**：集成 useConversation 到 App.tsx
2. **D3b**：集成 useSettings 到 App.tsx
3. **D4b**：集成 useExtensions 到 App.tsx
4. **E**：提取渲染函数到 views/（SettingsPage, ChatView, ComposerView, HomepageView, AppShell）
5. **F**：最终精简 App.tsx 至 ~400 行 + 更新全部摘要
