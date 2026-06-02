# Handoff Update Checklist

## Folder-Based Updates

Handoff updates are stored as **individual files** in `docs/development-status/handoff-updates/`, NOT in a single monolithic log file.

### File Naming

- Format: `NNN-<short-slug>.md` (e.g. `001-add-user-auth.md`, `002-fix-login-race.md`)
- `NNN` is a zero-padded sequential number (001, 002, 003, ...)
- `<short-slug>` is a hyphenated summary of the task (keep it under 40 chars)
- Files are ordered chronologically by their numeric prefix

### Creating a New Update

After substantial development work, create a new file in the `handoff-updates/` folder with the next available number. The file must cover:

- scope of the work
- high-signal code areas changed
- validations actually run
- whether the pre-development proposal and user confirmation were completed
- the commit created for this agent's work, or why commit creation was unavailable
- known failures, skipped checks, or unverified paths
- open questions or risks
- next recommended step for the next agent

### Reading Previous Updates (Mandatory)

**Before designing an engineering plan**, the agent MUST:

1. List all files in `docs/development-status/handoff-updates/`
2. Read every file in numeric order (001 → 002 → 003 → ...)
3. Use the accumulated history to inform the plan — past decisions, unresolved issues, deferred work, and known risks all feed into the current proposal

This ensures the agent understands the full context of what has been done, what was decided, and what remains open.

## File Template

Each handoff update file should follow this structure:

```md
# [NNN] — [Short Task Title]

**Date**: YYYY-MM-DD HH:MM +/-TZ

## Scope
- ...

## Code Areas Changed
- ...

## Validation
- ...

## Decision Gate
- Proposal presented: yes / no (small fix exemption)
- User confirmation received: yes / no / N/A

## Commit
- ...

## Known Failures / Skipped Checks
- ...

## Open Questions / Risks
- ...

## Next Step
- ...
```
