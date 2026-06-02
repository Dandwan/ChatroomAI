# 010 — Default Prompt Versioning

**Period**: 2026-05-08

> Migrated from monolithic `40-handoff-log.md`. See git history for original context.


## 2026-05-08 19:02 +08:00 — Default Prompt Versioning

### Scope

Added per-prompt version numbers so new APK installs can auto-update default prompts when the user hasn't modified them. Each of the 6 prompt fields now carries a version number; on load, if the stored version is lower than the current built-in version and the stored text matches the previous default, it auto-updates to the latest default.

### Changes

- `src/state/types.ts`: added `promptVersions: Record<string, number>` to `AppSettings`
- `src/services/skills/default-system-prompts.ts`:
  - added `PROMPT_VERSIONS` (all starting at 1)
  - added `PROMPT_PREVIOUS_VERSION_DEFAULTS` (empty, for future bump use)
  - added `migratePromptVersions()` — iterates prompt keys, compares version/default, auto-updates or preserves user edits
- `src/App.tsx`:
  - `DEFAULT_SETTINGS` now includes `promptVersions: {}`
  - `loadSettings()` runs `migratePromptVersions()` before returning
  - imported `migratePromptVersions`

### How to bump a default in the future

1. Update the `DEFAULT_*` constant content
2. Store the old default in `PROMPT_PREVIOUS_VERSION_DEFAULTS[key]`
3. Bump `PROMPT_VERSIONS[key]`

### Validation

- `npx tsc -b` — zero errors
- `npx vitest run` — 23/23 tests pass
- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings

### Proposal Gate

- Completed: presented plan, user confirmed

### Next Steps

- Bump a real prompt version when the next default text change lands
- Verify on-device after next APK install
