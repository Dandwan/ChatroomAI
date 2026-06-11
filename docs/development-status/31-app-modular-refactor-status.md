# App.tsx 模块化重构 — 现状、进度与剩余方案

**日期**：2026-06-11  
**来源**：handoff updates 069–077

---

## 一、目标

将 `src/App.tsx`（重构前 7,576 行）拆分为精简的 ~400 行 shell + 8 个自定义 hooks + 5 个 views 组件。

---

## 二、当前状态总览

| 维度 | 数值 |
|------|------|
| **App.tsx 行数** | 3,764（−3,812 行，−50.3%） |
| **tsc 错误** | **0** ✅ |
| **测试** | **39 passed** ✅（1 个 E2E 文件预存失败） |
| **构建（npm run build）** | ❌ 预存问题（`builtin-skills/runtime-shell/` 目录缺失） |
| **Git 提交** | 待提交（E1 完成） |

---

## 三、已完成工作（阶段 A/B/D1-D6/E1）

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
| **E1** | SettingsPage.tsx 提取 | −1,335 行 | 16 个渲染函数 → views/SettingsPage.tsx；tsc 0 |

### 8 个 hooks 全部就位 + 1 个 view 组件

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

### 阶段 E2–E5：剩余 Views 提取（估计 4–6 小时）

从 App.tsx 提取剩余内联渲染函数到独立组件：

| 组件 | 内容 | 估计行数 | 状态 | 复杂度 |
|------|------|---------|------|--------|
| **E1** `SettingsPage.tsx` | 16 个设置渲染函数 | ~1,300 | ✅ 已完成（077） | 高 — 35+ props，store 直访 |
| **E2** `ChatView.tsx` | 消息列表渲染、空/加载/错误态、`renderSkillStepEntry` | ~200 | ❌ | 高 — 消息 map 回调依赖多 |
| **E3** `ComposerView.tsx` | `renderComposerTools` + `renderComposerFooter` | ~300 | ❌ | 中 — ~20 个 props |
| **E4** `HomepageView.tsx` | 主页空白态渲染 | ~50 | ❌ | 低 — 简单提取 |
| **E5** `AppShell.tsx` | 顶层布局（主 JSX return 语句） | ~500 | ❌ | 高 — 几乎所有变量作为 props |

**预期**：E2-E5 完成后 App.tsx ~2,700 行

### 阶段 F：最终精简（估计 2–3 小时）

1. 将剩余内联 useCallback/useMemo 移入 hooks
2. 精简 App.tsx JSX 至纯组装（~400 行）
3. 更新全部 ~30 个代码摘要文件
4. 更新架构文档 `20-run-and-skill-runtime.md`
5. 创建 handoff update 078

**预期**：App.tsx ~400 行

---

## 五、待解决问题 / 风险

| # | 问题 | 影响 | 状态 |
|---|------|------|------|
| 1 | `npm run build` 失败 — `builtin-skills/runtime-shell/` 目录缺失 | 无法构建 Web/APK | 🔴 预存，与重构无关 |
| 2 | E2-E5 渲染函数提取 — 与 App 作用域深度交织 | 需逐个仔细解耦 | 🟡 E1 已验证模式可行 |
| 3 | `app-module.ts` 类型卫生 — `buildPersistChatState` 使用 `import(...)` 类型引用 | 不够优雅 | 🟢 低优先级 |
| 4 | 代码摘要 — 多个 hook 摘要需更新 | agent 依赖摘要可能不准确 | 🟡 部分已更新（App.tsx, SettingsPage.tsx） |

---

## 六、阶段性里程碑路线图

```
7,576 行 ────────────────────────────────────────── ~400 行

Phase 1 (069): 工具函数提取      ──→ 7,576 → 7,228 (−348)
Phase A (071): 导入清理          ──→ 7,228 → 7,228
Phase B (072): 模块提取          ──→ 7,228 → 6,221 (−1,007)
Phase D2: useChatUI 集成         ──→ 6,221 → 6,080 (−141)
Phase D5/D6: useUpdates/Perms    ──→ 6,080 → 5,986 (−94)
Phase D3: useSettings 集成       ──→ 5,986 → 5,682 (−304)
Phase D4: useExtensions 集成     ──→ 5,682 → 5,416 (−266)
Phase D1 (075): useConversation  ──→ 5,416 → 5,083 (−333)
Phase 076: 错误修复              ──→ 5,083 → 5,099 (+16, tsc: 0)
Phase E1 (077): SettingsPage     ──→ 5,099 → 3,764 (−1,335)  ← 当前位置
────────────────────────────────────────────────────
Phase E2-E5: 剩余 Views          ──→ 3,764 → ~2,700 (−1,064)
Phase F: 最终精简 + 摘要更新     ──→ ~2,700 → ~400

已减: −3,812 行 (−50.3%)
剩余: ~3,364 行
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
