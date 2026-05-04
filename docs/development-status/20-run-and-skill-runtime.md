# Run And Skill Runtime

## Current Execution Model

The project is in the middle of a large execution-model refactor:

- `run` is the primary execution action.
- `read` remains the file/dir inspection action.
- `edit` now exists as a first-class text-file editing action.
- legacy `skill_call` naming still exists in some settings/storage fields for compatibility, but the effective default execution prompt is the `run` version.

## Conversation Response Mode

- `src/App.tsx` now treats response mode as conversation-owned state instead of a global runtime switch.
- empty conversations can still switch between text mode and skill mode
- once the first user message exists in a conversation transcript, that conversation mode is treated as locked
- queued execution, regenerate, and append now all carry the locked conversation mode forward instead of re-reading a global mode flag
- persisted conversation metadata now stores the selected mode under conversation preferences so later history reloads can preserve the mode

## Run Pipeline

### TypeScript side

- `src/services/skills/run-parser.ts`
  - parses simple shell-like commands
  - supports quoted argv and leading env assignments
  - intentionally rejects shell operators such as pipes, redirection, command substitution, and subshell syntax
- `src/services/skills/run-resolver.ts`
  - resolves `skill` / `workspace` / `home` / `absolute` roots
  - distinguishes path-like launches from command-registry launches
  - falls back to Android system command locations for bare executable names
- `src/services/skills/location-files.ts`
  - centralizes `read` and `edit` location backends across `skill`, `workspace`, `home`, and native absolute paths
  - keeps protocol-facing naming on `location`, while internal compatibility still maps legacy `root` / `absolute`
- `src/services/skills/text-edit.ts`
  - applies line-based `insert` / `delete` / `replace` edits against one original snapshot
  - enforces atomic application, optional `expectedText`, and grouped preview snippets
- `src/services/skills/run-executor.ts`
  - materializes `run` actions before execution
  - auto-generates a session for new runs with `command`
  - requires explicit `session` when inspecting an existing run without `command`
  - special-cases `device-info` so `./get_device_info` is executed through the native helper path
  - no longer special-cases `union-search` webpage visits; `visit_url` / `fetch_url` now execute through the skill’s own Node path like other skill commands

### Android native side

- `SkillRuntimePlugin.executeRun(...)`
  - launches processes directly instead of routing through the deleted `runtime-shell` skill
  - stores run session state in memory and log files under `skill-host/state/run-sessions/`
  - separates “launch new run” from “inspect existing session”
  - only requires `session` when starting a new run
  - uses managed-runtime linker launching for Termux-based Node/Python runtimes
- `SkillRuntimePlugin.listAbsoluteDirectory(...)` / `statAbsolutePath(...)` / `readAbsoluteTextFile(...)` / `writeAbsoluteTextFile(...)`
  - expose native absolute-path file inspection and text-file writes for `location="root"` on native app builds

## Session Semantics

- New run with `command` and no `session`
  - host auto-generates a model-visible session such as `run-xxxxxxxx`
  - the generated session is returned in `run_result` / `run_error`
- Existing run inspection without `command`
  - caller must provide the session explicitly
- `App.tsx` and host transcript payloads now carry the model-visible session instead of leaking internal scoped session IDs

## Prompt State

- `src/services/skills/default-system-prompts.ts`
  - `DEFAULT_RUN_SYSTEM_PROMPT` is the active execution prompt
  - `DEFAULT_EDIT_SYSTEM_PROMPT` now exists as a separate edit-only action prompt
  - `DEFAULT_SKILL_CALL_SYSTEM_PROMPT` currently points at the same run prompt for storage/schema compatibility
  - active default examples in the top-level prompt docs were updated to show `<run>` instead of `<skill_call>`
  - active action prompts now teach `location` as the canonical field name, with `root` as the canonical external enum value for system absolute paths
  - run and edit prompt rules are now split again: `skillCallSystemPrompt` is run-only, `editSystemPrompt` is edit-only
  - parser compatibility still accepts legacy `root` and `absolute` in model output and normalizes them back to the new `location` / `root` protocol
  - the active run prompt now explicitly tells the model that search only discovers candidate links, and reading webpage content requires a follow-up `visit_url` / `fetch_url` call
- legacy snapshot strings are still kept for migration matching and old stored prompt detection

## Built-In Skills / Entry Points

- `runtime-shell` was removed from the repo and should no longer be part of the active built-in skill set
- `union-search` and `device-info` now expose no-extension entrypoints meant to be runnable via `run`
- current repo state still includes `.internal` helper scripts inside `builtin-skills/union-search/scripts/` and `builtin-skills/device-info/scripts/`
  - these are current tracked files, not merely stale phone residue
  - wrappers such as `web_search` still dispatch into `.internal` names inside the union-search implementation
- `union-search`
  - now exposes a model-facing `visit_url` entrypoint in addition to the compatibility alias `fetch_url`
  - the canonical source package now lives under `codex-skills/union-search/`
  - `visit_url` now uses a Defuddle-based extraction path owned by the skill itself
  - direct HTML mode fetches raw HTML with the skill request client, then runs Defuddle locally
  - browser mode is no longer host-provided; the skill now uses a local Chrome / Edge headless `--dump-dom` flow when browser mode is explicitly requested in a compatible desktop environment
  - webpage fetching no longer routes through `jina`
  - the skill frontmatter now advertises the two-step workflow explicitly: search for candidate links first, then visit the chosen URL for full page content
  - the skill networking layer now uses a reusable desktop Chromium Windows request profile for HTML and search traffic instead of the previous Android-mobile default headers
  - the request layer now maintains a per-process cookie jar and redirect-aware request headers so multi-step scraping behaves more like a real desktop browser session
  - `visit_url` now has a site-specific blocked-page fallback for Zhihu question URLs: when Zhihu returns the `zse-ck` challenge page, the skill returns a structured “访问受限” Markdown payload instead of surfacing a raw 403 exception
  - built-in app defaults now point `fetchUrl.preferredEngine` at `html`, not a host-provided browser path
- bundled runtime recovery is now idempotent:
  - already-installed bundled runtimes are re-prepared before cached metadata is reused
  - managed runtime launches self-heal execute bits before inspect/run paths start, so lost permissions on an existing runtime tree no longer surface as a `permission denied` runtime failure

## Built-In Skill Materialization

- `src/services/skills/host.ts` currently materializes built-in skills from repo-tracked bundles
- `union-search` is large enough that raw inlining is no longer acceptable
  - the host now keeps `SKILL.md` / `config-template.json` inline for metadata
  - the rest of the built-in files are imported as emitted asset URLs and fetched at materialization time
  - built-in materialization now writes a signature file and skips re-writing a built-in skill when the materialized snapshot already matches the current asset set
  - even when the snapshot is already current, built-in sync now re-prepares the `scripts/` subtree so stale execute bits on an existing built-in tree get repaired before the skill is reused
- a sync pass now deletes built-in skill directories that are no longer present in the repo definition, so removed built-ins such as `runtime-shell` should not keep living on device after re-sync
