# Development Status Index

Last updated: 2026-05-01 21:21 +08:00

This directory is the repo-tracked handoff state for ActiChat (`动话`, formerly `ChatroomAI`). Any agent taking over development in this repository should read these files before changing code and update them after finishing work.

On this machine, the global Codex skill `development-project-handoff` is intended to enforce that workflow for development repositories.

## Read Order

1. `10-project-overview.md`
2. `20-run-and-skill-runtime.md`
3. `30-current-state-and-known-issues.md`
4. `40-handoff-log.md`

## Update Contract

- Treat these files as engineering artifacts, not personal notes.
- Reconcile them with the codebase if they drift.
- Keep them in the same git branch / commit / PR as the related code changes.
- Update architecture, active issue, and validation notes when the underlying reality changes.
- Append a dated entry to `40-handoff-log.md` after each substantial development handoff.
- Do not replace project-specific detail with generic summaries.
