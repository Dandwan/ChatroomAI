---
name: development-project-handoff
description: This skill should be used whenever Claude is asked to "add a feature", "fix a bug", "refactor", "change this code", "modify", "update the project", "implement", "build", "debug", "investigate this issue", "review the codebase", or any other development task on an existing software repository. New features, refactors, reviews, and investigations always require the full workflow. Bug fixes are tiered: only small fixes (single file, obvious root cause, no API/architecture changes, 1-10 lines) may skip; all other bugs go through the full process. Read the project's development status directory first: index, all handoff updates in chronological order, architecture docs, current state — then decide if codebase exploration is needed. Propose a detailed engineering plan (approach, constraints, questions), wait for explicit user confirmation, then implement. Create a numbered handoff update file and a focused git commit after finishing.
---

# Development Project Handoff

## Overview

Use a repo-tracked development status directory as the first read and last write point for every software-project handoff. Keep project-specific state inside the repository so it moves with git instead of living only in chat history or local temp files.

This skill also enforces a decision gate before implementation: after reading the status docs and enough code to understand the task, present a maintainable, extensible, engineering-quality approach, state relevant constraints, raise genuine questions, and wait for explicit user confirmation before starting the actual development work.

## Skill Self-Distribution

This skill ships itself as a distributable package at `docs/development-status/.skill-package/`. When a project includes this package and has the CLAUDE.md snippet installed, any agent encountering the project for the first time will be guided through installation.

### Package Structure

The `.skill-package/` directory contains a complete copy of the skill: `SKILL.md`, `references/`, `VERSION`, `INSTALL.md`, and `claude-md-snippet.md`.

### Startup Version Detection

At the start of every conversation, if the project CLAUDE.md contains the `<!-- HANDOFF-SKILL-START -->` marker block, the agent MUST perform version detection before any development work:

1. Check whether `~/.claude/skills/development-project-handoff/SKILL.md` exists.
2. If the skill is **not installed**:
   - Read `~/.claude/.handoff-skill-ignored` (if it exists). This file contains one absolute project path per line.
   - If the current project's absolute path is in the ignored file → silently skip, do nothing.
   - If not ignored → prompt the user via AskUserQuestion with three options:
     - **安装/更新** — copy `docs/development-status/.skill-package/` to `~/.claude/skills/development-project-handoff/`, then replace the `<!-- HANDOFF-SKILL-START -->` … `<!-- HANDOFF-SKILL-END -->` block in the project CLAUDE.md with the contents of `claude-md-snippet.md`.
     - **忽略（本次）** — do nothing persistent; the prompt will appear again next session.
     - **永久忽略** — append the current project's absolute path as a new line to `~/.claude/.handoff-skill-ignored`.
3. If the skill **is installed**, compare versions by reading both VERSION files:
   - **Project version > local version** → prompt: "项目中的 handoff skill 包版本较新，是否更新本地 skill？" (same three options).
   - **Local version > project version** → prompt: "本地 handoff skill 版本较新，是否更新项目中的 skill 包？" (same three options).
   - **Versions match** → no prompt, proceed normally.

The VERSION file uses a date stamp (e.g. `2026-05-27`). String comparison is sufficient.

### CLAUDE.md Marker Block

The project CLAUDE.md manages the handoff skill configuration inside a delimited block:

```
<!-- HANDOFF-SKILL-START -->
<!-- Version: YYYY-MM-DD -->
<!-- Source: docs/development-status/.skill-package/ -->

... skill rules and version detection instructions ...

<!-- HANDOFF-SKILL-END -->
```

When installing or updating, replace the entire block (start marker through end marker, inclusive). If no block exists yet, append the snippet to the end of the file.

## Workflow



1. Confirm the task is software development on a codebase.
2. Find the repository root and status directory.
3. Read the status directory before changing code — start with `00-index.md` and `10-project-overview.md`.
4. **Read all handoff updates in chronological order.** List and read every file in `docs/development-status/handoff-updates/` by numeric order (001 → 002 → 003 → …). These contain the full history of decisions, tradeoffs, deferred work, and unresolved issues — treat them as required context for the engineering plan.
5. **Read the project architecture design documents (`20-*.md`) before exploring the codebase.** Understand the existing architecture, component interactions, data flow, API contracts, and important implementation choices. Do NOT skip to codebase exploration without first understanding the designed architecture.
6. Read current-state documents (`30-*.md`) for known issues, risks, and follow-up items.
7. **Only then decide on codebase exploration.** If the status directory is complete and up-to-date (judged by the last-modified dates in handoff updates vs. recent git activity), form the engineering plan directly from the docs and proceed to step 9. If docs are missing, incomplete, or clearly stale, fall through to step 8 (inspect the codebase).
8. Inspect the codebase enough to form a defensible engineering plan — but always cross-reference findings with the architecture docs. If code diverges from docs, treat the mismatch as work to resolve.
9. Before any implementation or file edits, present a **detailed engineering plan** following [references/pre-development-gate-checklist.md](references/pre-development-gate-checklist.md), then wait for explicit user confirmation.
10. Reconcile stale docs as part of the task.
11. Do the requested development work after confirmation.
12. Update the status directory before finishing — update stale architecture docs and create a new handoff update file in the `handoff-updates/` folder.
13. Keep the status updates in the same git work as the code changes.
14. Create a git commit containing only your own changes when git is available.

## Locate The Status Directory

- Prefer an existing repo-tracked status directory if the project already has one.
- Otherwise create `docs/development-status/`.
- Keep project status inside the repo. Do not move it into `~/.claude/skills`, temp folders, or chat-only notes.
- If the repo already uses a different tracked handoff directory by convention, honor that instead of creating a duplicate.
- When creating a new status directory, also create the `.skill-package/` subdirectory by copying the skill from `~/.claude/skills/development-project-handoff/` (SKILL.md, references/, VERSION, INSTALL.md, claude-md-snippet.md). This ensures the project carries its own distributable copy.

Use [references/status-directory-layout.md](references/status-directory-layout.md) when creating or repairing the directory structure.

## Read Before Coding

Read the status files **in this specific order** before making code changes:

1. `00-index.md` — understand the directory structure and conventions.
2. `10-project-overview.md` — understand the product, stack, and invariants.
3. **`handoff-updates/` folder** — read ALL files in numeric order (001 → 002 → 003 → …). This is mandatory. These files contain the full history of what was done, what decisions were made, what tradeoffs were accepted, what was deferred, and what risks remain open. Skipping this step means designing in the dark.
4. **`20-*.md` (architecture docs)** — read these BEFORE exploring the codebase. Understand the designed architecture, component interactions, data flow, and API contracts. Do not reverse-engineer architecture from code when docs exist.
5. `30-*.md` — current state, known issues, risks, follow-up items.

Only after reading all of the above, decide whether codebase exploration is needed (per the Workflow step 7).

If the layout differs from this convention, read all Markdown files in the status directory and infer the order from filenames and headings.

Build your engineering plan from the status docs AND the codebase. If they disagree, treat the mismatch as work to resolve — do not silently trust one over the other.

## Proposal And Confirmation Gate

- Before actual development begins, read the status docs, all handoff updates, architecture docs, and enough code to produce a **detailed, thoroughly-reasoned engineering plan**.
- The plan must be detailed enough that another engineer could implement it without guessing. Present all of the following sections:
  - **Proposed Approach (方案设计)** — files to change, component interactions, API/data contract changes, error handling strategy, testing approach, and a comparison against at least one alternative with reasoning.
  - **Constraints & Tradeoffs (约束与权衡)** — exact scope of what WILL and will NOT be modified (to prevent scope creep), backward compatibility, known limitations, performance implications, and dependency changes.
  - **Questions (疑问)** — every unclear aspect of the request, with implications stated. If genuinely no questions exist, write "没有疑问" and briefly explain why.
- If there is uncertainty about requirements, behavior, compatibility, data contracts, ownership, rollout, or architectural direction, ask instead of guessing.
- Do not invent questions when none exist, but do state "没有疑问" explicitly.
- Even when there are no questions, **stop and wait for explicit user confirmation** before starting implementation.

Use [references/pre-development-gate-checklist.md](references/pre-development-gate-checklist.md) for the full required content and template.

## Bug-Fix Standard

- Do not default to patch-style, workaround-style, or minimum-diff bug fixes when the root cause remains in place.
- Identify the root cause and design the repair so it is maintainable, extensible, and engineering-sound.
- Favor coherent fixes over piling on conditionals, bypasses, or narrow special cases.
- Structural, large-scope, or breaking fixes are allowed and encouraged when the bug is structural and those fixes are the cleanest durable solution.
- If the bug requires a large-scope or breaking fix, present that plan in the proposal-and-confirmation gate before changing code.

## Small Fix Exemption

A bug fix may skip the full handoff workflow only when **all** of the following criteria are met:

- The fix is contained in a single file.
- The root cause is immediately obvious (typo, wrong variable name, missing null/undefined guard, trivial logic error).
- No API contract, data schema, or interface changes.
- No architectural or structural changes.
- The fix is small in scope (typically 1–10 lines).

If any criterion is not met, the fix is **not** a small fix and must go through the full handoff workflow.

When skipping the workflow: still create a proper commit; still update the handoff log with a brief note if the fix touches a documented area.

## Treat Status Files As Tracked Engineering Context

- Check whether the project is under git.
- Keep status-file edits in the same branch / commit / PR as the related code changes whenever git is present.
- Do not leave the status directory stale while shipping code changes.
- If the repo is not under git, still maintain the directory and explicitly note that git tracking was unavailable.

## Commit Discipline For Multi-Agent Work

- After finishing the work, create a git commit automatically when git is available.
- The commit must contain only the changes made by the current agent for the current task.
- Inspect the worktree before committing. Do not sweep unrelated or other-agent changes into your commit.
- If needed, use selective staging or partial staging to isolate your own edits.
- Do not revert other agents' work just to make commit boundaries easier.
- If safe isolation is not possible, stop and ask the user instead of making a mixed commit.

Use [references/self-only-commit-checklist.md](references/self-only-commit-checklist.md) for the minimum commit-isolation workflow.

## Update Before Handoff

- Update architecture (`20-*.md`) or current-state (`30-*.md`) files if the work changed them.
- **Create a new handoff update file** in `docs/development-status/handoff-updates/` after substantial work:
  - Name it `NNN-<short-slug>.md` where NNN is the next sequential number (zero-padded: 001, 002, …).
  - Follow the template in [references/handoff-update-checklist.md](references/handoff-update-checklist.md).
  - Record:
    - the task you handled
    - the code areas changed
    - validations you ran
    - whether the proposal-and-confirmation gate was completed
    - the commit created, or why a commit could not be created
    - unresolved risks or open questions
    - the next recommended step
- Do NOT append to a single monolithic handoff log file. Always create a new numbered file in the `handoff-updates/` folder.

## Guardrails

- Do not create duplicate status directories in the same repo.
- Do not use this workflow for non-development tasks.
- Do not replace specific project notes with vague summaries.
- Do not create only a handoff update if deeper project-state files (`20-*.md`, `30-*.md`) also changed.
- Do not use a single monolithic handoff log file — always create individual numbered files in the `handoff-updates/` folder.
- Do not design an engineering plan before reading all previous handoff updates in chronological order.
- Do not explore the codebase before reading the architecture docs (`20-*.md`).
- Do not present a shallow or high-level-only plan — the proposal must be detailed enough for another engineer to implement without guessing.
- Do not start implementation before the explicit user confirmation required by this skill (except for qualifying small fixes per the Small Fix Exemption).
- The workflow may only be skipped for bug fixes that meet every criterion in the Small Fix Exemption section. All feature work, refactors, reviews, and investigations require the full workflow regardless of apparent simplicity.
- Do not guess through meaningful ambiguity.
- Do not leave a known root cause in place when claiming to have fixed a bug.
- Do not include other agents' changes in your commit.
- Do not skip the startup version detection step when the project CLAUDE.md contains the `<!-- HANDOFF-SKILL-START -->` marker.
- Do not modify the `<!-- HANDOFF-SKILL-START -->` … `<!-- HANDOFF-SKILL-END -->` block content directly — always use the full snippet from `claude-md-snippet.md` for consistency.
- Do not commit `~/.claude/.handoff-skill-ignored` to the repository — it is a per-user local file.
