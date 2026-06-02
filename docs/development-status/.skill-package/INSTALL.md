# Handoff Skill 安装指南

## 概述

本目录（`.skill-package/`）包含 Development Project Handoff Skill 的完整可分发包。当项目 CLAUDE.md 中已配置好检测逻辑后，任何 agent 首次接触该项目都会自动检测本地 skill 状态并提示安装。

## 自动安装流程（推荐）

Agent 启动时会自动执行版本检测，无需手动干预。流程如下：

1. Agent 读取项目 CLAUDE.md，找到 `<!-- HANDOFF-SKILL-START -->` 标记区块
2. 检查 `~/.claude/skills/development-project-handoff/` 是否已安装
3. 对比 VERSION 文件确认版本是否最新
4. 如未安装或版本过旧，弹出对话框询问：
   - **安装/更新** — 立即安装
   - **忽略（本次）** — 跳过，下次还会提示
   - **永久忽略** — 写入 `~/.claude/.handoff-skill-ignored`，不再提示

## 手动安装步骤

如果自动安装未触发或你需要手动安装：

### 1. 复制 Skill 包

将 `.skill-package/` 目录整体复制到用户 skills 目录：

**Windows (PowerShell):**
```powershell
Copy-Item -Recurse docs/development-status/.skill-package/ $env:USERPROFILE\.claude\skills\development-project-handoff\
```

**macOS / Linux (Bash):**
```bash
cp -r docs/development-status/.skill-package/ ~/.claude/skills/development-project-handoff/
```

注意：复制后 `~/.claude/skills/development-project-handoff/` 下应直接包含 `SKILL.md`、`references/`、`VERSION`、`INSTALL.md`、`claude-md-snippet.md`。

### 2. 更新项目 CLAUDE.md

将 `claude-md-snippet.md` 中的完整内容写入项目的 `.claude/CLAUDE.md` 文件中。

如果 CLAUDE.md 中已有 `<!-- HANDOFF-SKILL-START --> ... <!-- HANDOFF-SKILL-END -->` 标记区块，替换整个区块（包括起止标记）为新片段内容。

如果 CLAUDE.md 中没有标记区块，将片段内容追加到文件末尾。

### 3. 验证安装

在 Claude Code 中重新打开项目，agent 启动时若看到以下行为则安装成功：
- 自动读取 `docs/development-status/` 目录
- 自动执行 handoff 工作流（先读后改、提案门禁、交接更新）

也可以直接运行 `/development-project-handoff` 验证 skill 是否加载。

## 版本更新

当 `.skill-package/VERSION` 更新后：

- **项目包新于本地** → agent 提示更新本地 skill
- **本地新于项目包** → agent 提示更新项目中的 `.skill-package/`
- **版本一致** → 无需操作

## 卸载

删除 `~/.claude/skills/development-project-handoff/` 目录，并从项目 CLAUDE.md 中移除 `<!-- HANDOFF-SKILL-START -->` 到 `<!-- HANDOFF-SKILL-END -->` 之间的全部内容。

若已设置永久忽略，还需从 `~/.claude/.handoff-skill-ignored` 中删除对应项目路径。
