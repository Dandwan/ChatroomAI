<!-- HANDOFF-SKILL-START -->
<!-- Version: 2026-06-03 -->
<!-- Source: docs/development-status/.skill-package/ -->

# Development Handoff Skill — 启动检测与规范

## 版本检测（Agent 启动时自动执行）

在每次对话开始时，检查本地 handoff skill 状态：

1. 检查 `~/.claude/skills/development-project-handoff/SKILL.md` 是否存在
2. 如果不存在，检查 `~/.claude/.handoff-skill-ignored` 文件：
   - 如果文件中包含当前项目根目录的绝对路径 → 静默跳过（永久忽略）
   - 否则 → 弹出 AskUserQuestion，三个选项：
     - **安装**：复制 `docs/development-status/.skill-package/` 到 `~/.claude/skills/development-project-handoff/`，然后重新加载 skill
     - **忽略（本次）**：不做持久化，本次对话不加载
     - **永久忽略**：将当前项目绝对路径追加写入 `~/.claude/.handoff-skill-ignored`
3. 如果 skill 目录存在，读取项目 `docs/development-status/.skill-package/VERSION` 和本地 `~/.claude/skills/development-project-handoff/VERSION` 对比：
   - 项目版本 > 本地版本 → 弹窗提示"更新本地 skill"（选项同上）
   - 本地版本 > 项目版本 → 弹窗提示"更新项目 skill 包"（选项同上）
   - 版本一致 → 无需提示，直接使用

## Handoff Skill 使用规则

- **新增功能 (New feature)**：必须走完整 handoff 流程，无例外。
- **修 bug (Bug fix)**：
  - 若符合"小修复"标准（单文件、根因明显、无 API 变更、1-10 行），可跳过流程直接修复。
  - 其他所有 bug 必须走完整流程。
- **重构 / 审查 / 调研 (Refactor, review, investigate)**：必须走完整流程。

### 摘要优先探索

当需要探索（explore）代码库以理解代码结构、查找相关文件、或了解实现细节时，**禁止直接读取源码文件**。

必须按以下顺序操作：
1. 首先浏览 `docs/development-status/summaries/` 目录，通过摘要文件了解代码结构、文件关系、和关键符号（类名/函数名）
2. 仅当摘要信息不足以支撑当前任务时，才针对性地读取具体源码文件
3. 如果目标文件尚未创建摘要，读取源码后必须先创建摘要，再继续后续工作

**此规则适用于所有子 agent（包括 Explore agent）** — 在派发子 agent 时，必须在 prompt 中明确要求其遵守摘要优先协议。

<!-- HANDOFF-SKILL-END -->
