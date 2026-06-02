# Self-Only Commit Checklist

Use this workflow when working in a shared repository with possible multi-agent overlap:

1. Inspect the worktree before committing.
2. Identify which files and hunks belong to the current task and current agent.
3. Stage only those files or hunks.
4. If the same file contains unrelated edits, use partial staging to isolate your own changes.
5. If safe isolation is not possible, stop and ask the user instead of creating a mixed commit.
6. Create the commit automatically when git is available.
7. Record the commit identifier or the reason commit creation was unavailable in the handoff log.

## Guardrails

- Do not include unrelated work in the commit.
- Do not revert another agent's edits just to make the commit cleaner.
- Do not skip the commit when git is available.
