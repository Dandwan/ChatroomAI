# 074 — App.tsx 模块化重构：集成进度与剩余执行方案

**日期**：2026-06-11

## 范围

将 5 个自定义 hooks（D1, D3, D4, D5, D6）创建的成果集成到 App.tsx 中，通过解构替换内联代码，减少组件体积并提高可维护性。

## 整体进度总览

| 阶段 | 状态 | App.tsx 行数 | 变化 | 关键方法 |
|------|------|-------------|------|---------|
| 初始 | — | 7,576 | — | — |
| A 导入清理 | ✅ | 7,228 | −348 | 手动 + Python 移除未用导入 |
| B 模块提取 | ✅ | 6,221 | −1,007 | 提取到 utils/app-module.ts |
| D2 useChatUI | ✅ | 6,080 | −141 | 替换为 useChatUI hook |
| D5 useUpdates | ✅ | 5,986 | −94 | 解构 useUpdates hook |
| D6 usePermissions | ✅ | 5,986 | — | 解构 usePermissions hook |
| D3 useSettings | ✅ | 5,682 | −304 | **解构替换** 17 个内联函数 |
| D4 useExtensions | ✅ | 5,416 | −266 | **解构替换** 28 个内联函数 |
| D1 useConversation | 🔧 | — | — | hook 已导入，保留命名空间 |
| E views | ❌ | — | ~1,500 | 待开始 |
| F polish | ❌ | — | ~200 | 待开始 |
| **当前** | — | **5,416** | **−2,160 (−28.5%)** | |
| **目标** | — | **~400** | **−7,176 (−94.7%)** | |

## 集成方法论（已验证成功）

### 解构替换模式（D3, D4, D5, D6 均采用）

```
// Step 1: 导入 hook
import { useXxx } from './hooks/useXxx'

// Step 2: 在组件内解构 hook
const {
  functionName1,
  functionName2,
  stateValue1,
} = useXxx(params...)

// Step 3: 移除与解构名冲突的内联定义
// - 移除 useXxxStore() 选择器
// - 移除 useCallback/useMemo 定义
// - 移除简单 const 赋值

// Step 4: 编译验证 → 构建验证 → 测试验证
```

### 为什么 D1（useConversation）不能直接用解构替换

useConversation hook 包含 **10 个 useEffect/useLayoutEffect**：
1. 聊天索引加载（chat index load）
2. 对话持久化防抖（persistence debounce）
3. 图片数据 URL 水合（image hydration）
4. 备用对话创建（fallback conversation）
5. 对话切换清理（conversation switch cleanup）
6. 抽屉关闭清理（drawer cleanup）
7. 折叠分组同步（collapsed groups sync）
8. 自动折叠重置（auto-collapse reset）
9. 自动折叠布局（auto-collapse layout）
10. Ref 同步（ref sync）

如果解构 hook，这些 effects 会在 hook 调用时自动执行。但 App.tsx 中还有同功能的**内联 effects**。同时运行两套 effects 会导致：
- 对话被保存两次
- 聊天索引被加载两次
- 图片被水合两次
- 折叠状态可能不一致

**解决方案**：必须先从 App.tsx 中移除对应的内联 effects，再解构 hook。但这些 effects 与 App.tsx 的其他代码（渲染函数、事件处理）深度交织，需要逐块手动提取。

### D1 推荐集成步骤

1. 在 App.tsx 中找到并标记所有 10 个内联 effect（行号）
2. 每次移除一个 effect，编译验证 behavior 未改变
3. 所有 effects 移除完毕后，解构 conv hook
4. 移除重复的 store selectors 和 computed values
5. 最终验证：tsc + build + test

**估计影响**：−400 行 App.tsx 代码

## 变更的代码区域

### 已修改文件

| 文件 | 操作 | 阶段 | 行数变化 |
|------|------|------|---------|
| `src/hooks/useUpdates.ts` | 新建 | D5 | +83 |
| `src/hooks/usePermissions.ts` | 新建 | D6 | +94 |
| `src/hooks/useSettings.ts` | 新建+修改 | D3 | +319 |
| `src/hooks/useExtensions.ts` | 新建 | D4 | +416 |
| `src/hooks/useConversation.ts` | 新建 | D1 | +470 |
| `src/App.tsx` | 修改 | D3-D6 | −870 |

### 待提取文件（阶段 E）

| 文件 | 内容 | 估计行数 |
|------|------|---------|
| `src/views/SettingsPage.tsx` | 16 个设置渲染函数 | ~1,300 |
| `src/views/ChatView.tsx` | 消息列表渲染 | ~200 |
| `src/views/ComposerView.tsx` | 输入框渲染 | ~100 |
| `src/views/HomepageView.tsx` | 主页空白态 | ~50 |
| `src/views/AppShell.tsx` | 顶层布局 | ~100 |

## 验证

每阶段完成后：
```bash
npx tsc -b --noEmit    # TypeScript 零新错误（允许 8 个预存错误）
npm run build           # Vite 构建成功
npx vitest run          # 39 测试通过（1 E2E 预存失败）
wc -l src/App.tsx       # 确认行数递减
```

## 决策关卡

- 方案已提出：是（070-app-modular-refactor-completion-plan.md）
- 用户确认已收到：是

## 提交记录

```
1acabee docs: 更新当前状态 — D3/D4 集成完成，App.tsx 5,416 行
ccd02ba D4b: 集成 useExtensions hook — App.tsx −266 行
c02a84c D3b: 集成 useSettings hook — App.tsx −304 行
c656062 feat: 所有 5 个 hooks（D1/D3/D4/D5/D6）已导入 App.tsx
a4c2fc0 docs: 更新 30-current-state — D1-D6 全部完成
201ba93 docs: 更新 handoff update 073（D1-D6 完成）+ 所有摘要
d774d4a D1: 创建 useConversation hook（~470 行）
1ef513d D3: 创建 useSettings hook（~280 行）
4edfbe8 D4: 创建 useExtensions hook（~400 行）
ee5464b D5+D6: 提取 useUpdates 和 usePermissions hooks
```

## 已知失败 / 跳过的检查

- D1 解构集成被跳过（effects 风险需逐块手动处理）
- 阶段 E（views 提取）未开始
- 阶段 F（最终精简）未开始

## 待解决问题 / 风险

1. **D1 effects 重复执行**：useConversation hook 的 10 个 effects 与 App.tsx 内联 effects 同时存在时会重复执行。必须先将内联 effects 全部移除后才能解构 hook。
2. **SettingsPage views 提取**：16 个渲染函数引用了大量内联变量。方案是让 SettingsPage 直接访问 zustand stores（已在骨架中规划好）。
3. **预存 tsc 错误**：8 个 TS2304/TS2552 错误未修复（removePendingImage 等）。

## 下一步（按优先级）

### 第一阶段：D1 集成（估计 1 小时）
1. 在 App.tsx 中找到 10 个内联 conversation effects 的精确行号
2. 逐个移除内联 effect，每次编译验证
3. 全部移除后解构 `const conv = useConversation(initialStateRef)` 
4. 移除重复的 chat store selectors 和 computed values
5. 预期效果：App.tsx −400 行 → ~5,016 行

### 第二阶段：Views 提取（估计 2 小时）
1. **E1 SettingsPage.tsx**：提取 16 个设置渲染函数，直接访问 zustand stores（−1,300 行）
2. **E2 ChatView.tsx**：提取消息列表渲染（−200 行）
3. **E3 ComposerView.tsx**：提取输入框渲染（−100 行）
4. **E4 HomepageView.tsx**：提取主页空白态渲染（−50 行）
5. **E5 AppShell.tsx**：提取顶层布局组装（−100 行）
6. 预期效果：App.tsx −1,750 行 → ~3,266 行

### 第三阶段：最终精简（估计 30 分钟）
1. 精简 App.tsx 至纯 hooks 调用 + JSX 组装
2. 更新所有代码摘要文件（~30 个文件）
3. 更新架构文档 20-*.md
4. 创建最终 handoff update 075
5. 预期效果：App.tsx ~400 行

## 关键技术模式

### 解构替换（用于 D3/D4/D5/D6）
```typescript
// Before: inline code
const settings = useSettingsStore((s) => s.settings)
const applySettingsUpdate = useCallback(...)
const handleNumericSettingChange = (...) => {...}

// After: destructured hook
const {
  settings,
  applySettingsUpdate,
  handleNumericSettingChange,
} = useSettings(pushNotice, openDeleteDialog)
```

### 命名空间调用（用于 D1，当前状态）
```typescript
const conv = useConversation(initialStateRef)
// 使用时: conv.activeConversation, conv.createNewConversation()
```

### Views 访问模式（阶段 E 目标）
```typescript
// SettingsPage.tsx - 直接访问 stores
function SettingsPage(props) {
  const settings = useSettingsStore((s) => s.settings)
  const settingsView = useUIStore((s) => s.settingsView)
  // ... 渲染逻辑
}
```

## 关联文档
- 完成方案：`handoff-updates/070-app-modular-refactor-completion-plan.md`
- 阶段 A 报告：`handoff-updates/071-app-modular-refactor-phase-a.md`
- 早期进度：`handoff-updates/072-app-modular-refactor-progress.md`
- Hook 创建报告：`handoff-updates/073-app-modular-refactor-d1-d6-complete.md`
- 本文件：`handoff-updates/074-app-modular-refactor-integration-progress.md`
