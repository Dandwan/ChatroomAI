# 015 — 升级交接文档体系至 skill v2026-06-03

**日期**：2026-06-03

## 范围

将项目交接文档体系从 `development-project-handoff` skill v2026-05-27 升级至 v2026-06-03。纯文档结构更新，无源代码变更。核心变更：引入代码摘要系统（`summaries/` 目录）和摘要优先探索协议。

## 变更的代码区域

### `.skill-package/` — 更新至 v2026-06-03
- `VERSION` — `2026-05-27` → `2026-06-03`
- `SKILL.md` — 英文版 → 中文版（含代码摘要章节和摘要优先探索工作流）
- `references/*.md` — 全部更新至中文版，新增 `summary-template.md`
- `claude-md-snippet.md` — 添加「摘要优先探索」规则块，保留项目特有 Source 路径（`docs/development-status/.skill-package/`）

### `CLAUDE.md` — HANDOFF-SKILL 块更新
- 版本标记：`2026-05-27` → `2026-06-03`
- 新增「摘要优先探索」部分（3 步协议 + 子 agent 适用声明）

### `00-index.md` — 扩展读取顺序和更新契约
- 读取顺序：新增第 5 项 `summaries/`（摘要优先探索）
- 新增「Summary-First Protocol」章节
- 更新契约：新增"每次代码变更后更新对应摘要"的条目
- 更新日期至 2026-06-03

### `summaries/` — 新建（空目录镜像）
- 创建 131 个目录，镜像项目源码树（`src/`、`cloud-server/`、`android/`、`codex-skills/`、`builtin-skills/`、`public/`、`scripts/`）
- 已排除：`node_modules/`、`dist/`、`build/`、`.gradle/`、`.kotlin/`
- 摘要文件将在后续开发中增量构建——每次修改源文件时创建/更新对应摘要

## 验证

- 确认 `.skill-package/VERSION` = `2026-06-03`
- 确认 `.skill-package/references/` 包含 5 个文件（含 `summary-template.md`）
- 确认 `.skill-package/SKILL.md` 为中文版
- 确认 `CLAUDE.md` HANDOFF 块含版本 `2026-06-03` 和摘要优先探索规则
- 确认 `00-index.md` 含 summaries 引用
- 确认 `summaries/` 目录结构存在（131 目录，已排除构建产物/依赖目录）

## 决策关卡

- 方案已提出：是
- 用户确认已收到：是

## 提交

- 待创建（将包含本次所有文档变更）

## 已知失败 / 跳过的检查

- 无源代码构建/测试验证（纯文档变更）

## 待解决问题 / 风险

- `summaries/` 目录目前为空镜像——历史源文件尚未创建摘要。按 skill 的增量构建策略，摘要将在后续文件修改时逐步添加。对于关键的架构文件（如 `src/App.tsx`、`src/services/skills/run-executor.ts` 等），建议在下一轮开发中优先创建摘要。
- 已迁移的 handoff-update 文件（001-012）仍保留旧模板格式（英文标题），可选择性在后续做模板规范统一。

## 下一步

- 在后续功能开发/bug 修复中，每次修改文件时按 `summary-template.md` 规范创建/更新对应摘要
- 优先为 `src/App.tsx`、`src/services/skills/` 核心模块、`cloud-server/src/` 入口文件创建摘要，以便摘要优先探索协议能实际运作
