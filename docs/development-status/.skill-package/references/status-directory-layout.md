# Status Directory Layout

Use this layout unless the repo already has a clear tracked alternative:

1. `docs/development-status/00-index.md`
   - purpose
   - read order
   - update contract
2. `docs/development-status/10-project-overview.md`
   - product summary
   - stack
   - important repo areas
   - build / test commands
   - project invariants
3. `docs/development-status/20-*.md`
   - current architecture
   - active subsystems
   - execution model
   - important implementation choices
   - component / module interaction diagrams (text or reference)
   - data flow and API contracts
4. `docs/development-status/30-*.md`
   - current state
   - validated behavior
   - known issues
   - current risks
   - next follow-up items
5. `docs/development-status/handoff-updates/`
   - one file per handoff update, named `NNN-<short-slug>.md` (e.g. `001-add-user-auth.md`, `002-fix-login-race.md`)
   - files are ordered by their numeric prefix, representing chronological order
   - each file follows the template in [handoff-update-checklist.md](handoff-update-checklist.md)
   - **agents MUST read all files in this folder in numeric order before designing an engineering plan**, so they understand the full history of decisions, tradeoffs, and unresolved issues
   - do NOT use a single monolithic handoff log file (e.g. `40-handoff-log.md`); always use the folder

## Writing Rules

- Keep the directory specific to the repo, not generic to all projects.
- Prefer small topical files over one giant narrative.
- Update the stable overview files when architecture or constraints change.
- Use the `handoff-updates/` folder for dated change snapshots, not as the only source of truth.
- Keep the directory on a tracked repo path so it ships with git.

## Skill Self-Distribution Package

The `.skill-package/` directory contains a self-contained distributable copy of the Development Project Handoff Skill. This enables automatic version detection and install prompting for any agent that encounters the project.

```
.skill-package/
├── VERSION                  # Date-stamp version (e.g. "2026-05-27")
├── INSTALL.md               # Manual and automatic install instructions
├── claude-md-snippet.md     # CLAUDE.md fragment with version detection and handoff rules
├── SKILL.md                 # Full skill definition
└── references/              # All reference files
    ├── status-directory-layout.md
    ├── pre-development-gate-checklist.md
    ├── handoff-update-checklist.md
    └── self-only-commit-checklist.md
```

- `VERSION` uses a date stamp. Update it whenever the skill package changes.
- `claude-md-snippet.md` uses `<!-- HANDOFF-SKILL-START -->` / `<!-- HANDOFF-SKILL-END -->` markers to delimit the managed block in the project's CLAUDE.md.
- When version mismatches are detected at agent startup, the agent prompts the user to install/update.
