# App.tsx 模块化重构 — 现状、进度与剩余方案

**日期**：2026-06-11  
**来源**：handoff updates 069–076

---

## 一、目标

将 `src/App.tsx`（重构前 7,576 行）拆分为精简的 ~400 行 shell + 8 个自定义 hooks + 5 个 views 组件。

---

## 二、当前状态总览

| 维度 | 数值 |
|------|------|
| **App.tsx 行数** | 5,099（−2,477 行，−32.7%） |
| **tsc 错误** | **0** ✅ |
| **测试** | **39 passed** ✅（1 个 E2E 文件预存失败） |
| **构建（npm run build）** | ❌ 预存问题（`builtin-skills/runtime-shell/` 目录缺失） |
| **Git 提交** | `09cd231` feat: D1 集成完成 + 全部编译错误修复 (076) |

---

## 三、已完成工作（阶段 A/B/D1-D6）

| 阶段 | 内容 | 效果 | 备注 |
|------|------|------|------|
| **A** | 导入清理 + 死代码移除 | −348 行 | 移除 5 个完全未用的导入块 |
| **B** | 模块级代码提取到 `utils/app-module.ts` | −1,007 行 | 42 个命名导入替换内联定义 |
| **D1** | useConversation hook 创建+集成 | −333 行 | 命名空间→解构，4 个 effects 替换 |
| **D2** | useChatUI hook 集成 | −141 行 | UI 交互处理函数 |
| **D3** | useSettings hook 创建+集成 | −304 行 | 解构替换 17 个内联函数 |
| **D4** | useExtensions hook 创建+集成 | −266 行 | 解构替换 28 个内联函数 |
| **D5** | useUpdates hook 创建+集成 | −45 行 | APK 更新检查/安装 |
| **D6** | usePermissions hook 创建+集成 | −54 行 | 原生权限请求 |
| **076** | 全部编译错误修复 | tsc: 10→0 | 恢复 8 个丢失函数 + 类型修复 |

### 8 个 hooks 全部就位

| Hook | 文件 | 已集成？ | 076 新增函数 |
|------|------|---------|-------------|
| useAssistant | `src/hooks/useAssistant.ts` | ✅ | — |
| useChatUI | `src/hooks/useChatUI.ts` | ✅ | — |
| useCloudAuth | `src/hooks/useCloudAuth.ts` | ✅ | — |
| useSettings | `src/hooks/useSettings.ts` | ✅ | `resetPromptToDefault`, `fetchProviderModels`, `testProviderModel` |
| useExtensions | `src/hooks/useExtensions.ts` | ✅ | — |
| useUpdates | `src/hooks/useUpdates.ts` | ✅ | — |
| usePermissions | `src/hooks/usePermissions.ts` | ✅ | — |
| useConversation | `src/hooks/useConversation.ts` | ✅ | `removePendingImage`, `updatePendingImageCompression` |

---

## 四、待完成工作

### 阶段 E：Views 提取（估计 2–3 小时）

从 App.tsx 提取内联渲染函数到独立组件：

| 组件 | 内容 | 估计行数 | 状态访问策略 |
|------|------|---------|-------------|
| **E1** `SettingsPage.tsx` | 16 个设置渲染函数 | ~1,300 | 直接访问 Zustand stores |
| **E2** `ChatView.tsx` | 消息列表渲染、空/加载/错误态 | ~200 | props + stores |
| **E3** `ComposerView.tsx` | 输入框、工具按钮、图片预览 | ~100 | props + stores |
| **E4** `HomepageView.tsx` | 主页空白态、统计数据展示 | ~50 | props + stores |
| **E5** `AppShell.tsx` | 顶层布局、Drawer/Modals 组装 | ~100 | children + stores |

**预期**：App.tsx −1,750 行 → ~3,350 行

### 阶段 F：最终精简（估计 1 小时）

1. 精简 App.tsx 至纯 hooks 调用 + JSX 组装（~400 行）
2. 更新全部 ~30 个代码摘要文件（`docs/development-status/summaries/`）
3. 更新架构文档 `20-run-and-skill-runtime.md`
4. 创建最终 handoff update 077

**预期**：App.tsx ~400 行

---

## 五、待解决问题 / 风险

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | `npm run build` 失败 — `builtin-skills/runtime-shell/` 目录缺失 | 无法构建 Web/APK | 🔴 预存，与重构无关 |
| 2 | D1 effects 行为等价性 — hook 版缺少 `setNotice` 错误提示 | 部分错误场景用户无感知 | 🟡 需端到端验证 |
| 3 | `app-module.ts` 类型卫生 — `buildPersistChatState` 使用 `import(...)` 类型引用 | 不够优雅 | 🟢 低优先级 |
| 4 | 阶段 E views 提取 — 渲染函数与 App 作用域深度交织 | 需要仔细解耦 | 🟡 高风险 |
| 5 | 代码摘要过时 — 多个 hook 摘要仍标记为"计划"状态 | agent 依赖摘要可能获取错误信息 | 🟡 阶段 F 修复 |

---

## 六、阶段性里程碑路线图

```
7,576 行 ────────────────────────────────────────── ~400 行

Phase 1 (069): 工具函数提取      ──→ 7,576 → 7,228 (−348)
Phase A (071): 导入清理          ──→ 7,228 → 7,228 (includes phase B prep)
Phase B (072): 模块提取          ──→ 7,228 → 6,221 (−1,007)
Phase D2: useChatUI 集成         ──→ 6,221 → 6,080 (−141)
Phase D5/D6: useUpdates/Perms    ──→ 6,080 → 5,986 (−94)
Phase D3: useSettings 集成       ──→ 5,986 → 5,682 (−304)
Phase D4: useExtensions 集成     ──→ 5,682 → 5,416 (−266)
Phase D1 (075): useConversation  ──→ 5,416 → 5,083 (−333)
Phase 076: 错误修复              ──→ 5,083 → 5,099 (+16, tsc: 0)  ← 当前位置
────────────────────────────────────────────────────
Phase E: Views 提取              ──→ 5,099 → ~3,350 (−1,750)
Phase F: 最终精简 + 摘要更新     ──→ ~3,350 → ~400

已减: −2,477 行 (−32.7%)
剩余: ~4,700 行
```

---

## 七、验证命令

每次提交前：

```bash
npx tsc -b --noEmit      # TypeScript: 目标 0 错误
npm run build             # Vite 构建（预存 runtime-shell 问题）
npx vitest run            # Vitest: 目标 39 passed
wc -l src/App.tsx         # 确认行数递减
```

---

## 八、关联文档索引

| 文档 | 内容 |
|------|------|
| `handoff-updates/069-*.md` | 阶段 1：工具函数提取 + hook 规划 |
| `handoff-updates/070-*.md` | 完整重构方案（6 阶段路线图） |
| `handoff-updates/071-*.md` | 阶段 A：导入清理与死代码移除 |
| `handoff-updates/072-*.md` | 当前进度与剩余执行方案 |
| `handoff-updates/073-*-d1-d6-complete.md` | D1-D6 五个 hooks 提取完成 |
| `handoff-updates/073-*-d3-d6-hooks.md` | D3-D6 四个 hook 提取细节 |
| `handoff-updates/074-*.md` | 集成进度与剩余执行方案 |
| `handoff-updates/075-*.md` | D1 集成进度（尚未写入文件） |
| `handoff-updates/076-*.md` | D1 集成完成 + 全部编译错误修复 |
| `20-run-and-skill-runtime.md` | 架构设计文档 |
| `30-current-state-and-known-issues.md` | 当前状态与已知问题 |
