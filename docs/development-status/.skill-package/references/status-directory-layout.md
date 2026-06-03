# 状态目录布局

除非仓库已有明确的可追踪替代方案，否则使用此布局：

1. `docs/development-status/00-index.md`
   - 用途
   - 读取顺序
   - 更新契约
2. `docs/development-status/10-project-overview.md`
   - 产品摘要
   - 技术栈
   - 重要的仓库区域
   - 构建/测试命令
   - 项目不变量
3. `docs/development-status/20-*.md`
   - 当前架构
   - 活跃子系统
   - 执行模型
   - 重要的实现选择
   - 组件/模块交互图（文字或引用）
   - 数据流和 API 契约
4. `docs/development-status/30-*.md`
   - 当前状态
   - 已验证的行为
   - 已知问题
   - 当前风险
   - 后续事项
5. `docs/development-status/handoff-updates/`
   - 每次交接更新一个文件，命名为 `NNN-<简短描述>.md`（例如 `001-add-user-auth.md`、`002-fix-login-race.md`）
   - 文件按编号前缀排序，代表时间顺序
   - 每个文件遵循 [handoff-update-checklist.md](handoff-update-checklist.md) 中的模板
   - **agent 在设计工程方案之前必须按编号顺序读取此文件夹中的所有文件**，以理解决策、权衡和未解决问题的完整历史
   - 不要使用单个整体的交接日志文件（例如 `40-handoff-log.md`）；始终使用文件夹
6. `docs/development-status/summaries/`
   - 项目中每个源文件、配置文件或构建文件对应一个 `<文件名>.md` 摘要
   - 目录树完全**镜像项目结构**
   - 遵循 [summary-template.md](summary-template.md) 中的模板
   - agent **每次代码变更后必须更新或创建**相应摘要
   - agent 在导航代码库时**必须先通过摘要探索**，再读取原始源文件
   - 默认排除：`.git/`、`node_modules/`、`venv/`、`.venv/`、`vendor/`、`dist/`、`build/`、`__pycache__/`、`.next/`、`.nuxt/`、`target/`、`out/`、`*.lock`、二进制文件以及 `summaries/` 本身

## 编写规则

- 保持目录针对仓库特定内容，而非对所有项目通用。
- 倾向于小的主题文件，而非一个庞大的叙事文件。
- 当架构或约束变化时更新稳定的概述文件。
- 使用 `handoff-updates/` 文件夹存放带有日期的变更快照，而非作为唯一的真相来源。
- 将目录保留在已追踪的仓库路径上，使其随 git 发布。

## 技能自分发包

`.skill-package/` 目录包含 Development Project Handoff Skill 的独立可分发包。这使得任何遇到该项目的 agent 都能进行自动版本检测和安装提示。

```
.skill-package/
├── VERSION                  # 日期戳版本（例如 "2026-05-27"）
├── INSTALL.md               # 手动和自动安装说明
├── claude-md-snippet.md     # 包含版本检测和交接规则的 CLAUDE.md 片段
├── SKILL.md                 # 完整技能定义
└── references/              # 所有参考文件
    ├── status-directory-layout.md
    ├── pre-development-gate-checklist.md
    ├── handoff-update-checklist.md
    ├── summary-template.md
    └── self-only-commit-checklist.md
```

- `VERSION` 使用日期戳。每当技能包发生变化时更新它。
- `claude-md-snippet.md` 使用 `<!-- HANDOFF-SKILL-START -->` / `<!-- HANDOFF-SKILL-END -->` 标记来分隔项目 CLAUDE.md 中被管理的块。
- 当 agent 启动时检测到版本不匹配，agent 会提示用户安装/更新。
