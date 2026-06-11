# 078 — 阶段 E2-E5 完成：全部 Views 组件提取 + AppShell

**日期**：2026-06-11

## 范围

完成 App.tsx 模块化重构的 E2-E5 阶段，提取剩余 4 个 views 组件，完成 AppShell 布局壳封装。随后进行阶段 F 最终精简和文档更新。

## 当前状态总览

| 维度 | 数值 |
|------|------|
| **App.tsx 行数** | 3,191（从 7,576 −4,385，−57.9%） |
| **tsc 错误** | **0** ✅ |
| **测试** | **39 passed** ✅（1 个 E2E 预存失败） |
| **Views 组件** | **5 个全部就位** ✅ |
| **Hooks** | 8 个全部就位 ✅ |

## 变更的代码区域

### 新建文件（4 个 views）

| 文件 | 内容 | 估计行数 |
|------|------|---------|
| `src/views/HomepageView.tsx` | 主页空白态渲染（E4） | ~100 |
| `src/views/ComposerView.tsx` | 聊天输入区（E3） | ~280 |
| `src/views/ChatView.tsx` | 消息列表渲染（E2） | ~270 |
| `src/views/AppShell.tsx` | 顶层布局壳（E5） | ~80 |

### 修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/App.tsx` | 修改 | 移除内联渲染函数，替换为 views 组件调用（−573 行） |

### 新建摘要文件

| 文件 | 说明 |
|------|------|
| `docs/development-status/summaries/src/views/HomepageView.tsx.md` | E4 组件摘要 |
| `docs/development-status/summaries/src/views/ComposerView.tsx.md` | E3 组件摘要 |
| `docs/development-status/summaries/src/views/ChatView.tsx.md` | E2 组件摘要 |
| `docs/development-status/summaries/src/views/AppShell.tsx.md` | E5 组件摘要 |

### 修改的摘要文件

| 文件 | 说明 |
|------|------|
| `docs/development-status/summaries/src/App.tsx.md` | 反映全部 5 个 views 提取完成 |

## 各阶段详情

### E4: HomepageView.tsx（−25 行）
- 提取主页空白态三种状态的条件渲染
- Props: ~15 个字段（状态标志、回调、ref）
- App.tsx: 3,764 → 3,739

### E3: ComposerView.tsx（−307 行）
- 合并 renderComposerTools + renderComposerFooter
- 组织化 Props 接口：ComposerModelControls、ComposerActions、ComposerRefs
- 直接访问 stores：useSettingsStore、useUIStore
- App.tsx: 3,739 → 3,432

### E2: ChatView.tsx（−251 行）
- 提取消息列表 map 回调
- renderSkillStepEntry 从 map 回调内部提升到组件作用域
- resolveEmptyResponseProvider 提升到组件作用域
- 直接访问 stores：useUIStore
- App.tsx: 3,432 → 3,181

### E5: AppShell.tsx（+10 行）
- 封装顶层布局结构
- 使用 ReactNode children-as-props 模式
- App.tsx: 3,181 → 3,191

### F: 最终精简 + 文档更新
- 清理各阶段产生的未使用导入/变量
- 创建 4 个新 views 组件的代码摘要
- 更新 App.tsx 摘要
- 更新 `30-current-state-and-known-issues.md`
- 更新 `31-app-modular-refactor-status.md`
- 创建本交接更新文件 078

## 架构决策

### Views 提取模式（E1 建立，E2-E5 遵循）
所有 5 个 views 组件使用相同的混合访问策略：
- **状态读取** → 直接使用 Zustand stores，避免 props drilling
- **操作函数** → 通过组织化 props 接口从 hooks 传递
- **本地状态** → 通过 flat props 从 App.tsx 传递

### ComposerView 的接口分组
由于依赖较多（~40 个），将 props 分为 3 个逻辑接口：
- `ComposerModelControls` — 模型选择器相关操作
- `ComposerActions` — 发送/交互操作
- `ComposerRefs` — 相关 DOM refs

### AppShell 的 children-as-props 模式
AppShell 通过 ReactNode props 接收子元素而非使用标准的 children prop——因为子元素有复杂的嵌套关系和多区域分布。

## 验证

每阶段完成后均通过：
```bash
npx tsc -b --noEmit    # 0 错误
npx vitest run          # 39 passed（1 E2E 预存失败）
wc -l src/App.tsx       # 确认行数递减
```

## 决策关卡
- 方案已确认：是（plan: transient-enchanting-bubble.md，用户批准）

## 未解决问题

1. `npm run build` 失败（`builtin-skills/runtime-shell/` 缺失）— 预存问题，与重构无关
2. App.tsx 仍有 ~3,191 行，未达到原计划的 ~400 行目标 — 剩余约 2,800 行代码是仍在使用中的业务逻辑（hooks 调用、内联 useCallback/useMemo、事件处理函数、效果 hook），这些需要进一步系统性地迁移到现有 hooks 中
3. AppShell 的 children-as-props 模式导致行数略增（+10），但提供了清晰的架构分离
4. 约 124 个 `void` 语句待进一步清理（很多是为保持 JSX prop 引用而添加的）

## 建议的下一步

1. 修复 `npm run build`（runtime-shell 缺失）
2. 将 App.tsx 中剩余的内联 useCallback/useMemo 逐步迁移到对应 hooks
3. 将 useConversation 从命名空间改为解构模式
4. 端到端验证完整聊天流程

## 关联文档
- 重构状态：`31-app-modular-refactor-status.md`
- 前一更新：`077-app-modular-refactor-e1-complete.md`
- 完整方案：`070-app-modular-refactor-completion-plan.md`
- 计划文件：`transient-enchanting-bubble.md`
