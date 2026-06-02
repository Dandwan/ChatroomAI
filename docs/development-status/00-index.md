# Development Status Index

Last updated: 2026-06-02

This directory is the repo-tracked handoff state for **ActiChat** (`动话`, formerly `ChatroomAI`). Any agent taking over development in this repository should read these files before changing code and update them after finishing work.

## Read Order

1. `10-project-overview.md` — product summary, stack, invariants
2. `20-run-and-skill-runtime.md` — architecture, execution model, run pipeline, skill runtime
3. `30-current-state-and-known-issues.md` — current state summary, known issues, active risks
4. `handoff-updates/` — **read ALL files in numeric order (001 → 012 → …)** — full history of decisions, tradeoffs, deferred work, and unresolved issues

## Update Contract

- Treat these files as engineering artifacts, not personal notes.
- Reconcile them with the codebase if they drift.
- Keep them in the same git branch / commit / PR as the related code changes.
- Update architecture (`20-*.md`) and current-state (`30-*.md`) files when the underlying reality changes.
- After each substantial development session, create a **new numbered file** in `handoff-updates/` (e.g. `013-<slug>.md`), following the template in `.skill-package/references/handoff-update-checklist.md`.
- Do **not** append to a single monolithic log file — always use the `handoff-updates/` folder.
- Do not replace project-specific detail with generic summaries.

## Skill Self-Distribution

This directory includes a `.skill-package/` containing the `development-project-handoff` skill. The project root `CLAUDE.md` references it for automatic version detection at agent startup. See `.skill-package/INSTALL.md` for installation details.
