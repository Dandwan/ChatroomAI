# Run And Skill Runtime

## Current Execution Model

The project is in the middle of a large execution-model refactor:

- `run` is the primary execution action.
- `read` remains the file/dir inspection action.
- legacy `skill_call` naming still exists in some settings/storage fields for compatibility, but the effective default execution prompt is the `run` version.

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
- `src/services/skills/run-executor.ts`
  - materializes `run` actions before execution
  - auto-generates a session for new runs with `command`
  - requires explicit `session` when inspecting an existing run without `command`
  - special-cases `device-info` so `./get_device_info` is executed through the native helper path
  - now also special-cases `union-search` `visit_url` / `fetch_url` so native app builds can route those commands into a browser-backed extractor instead of the Node process path

### Android native side

- `SkillRuntimePlugin.executeRun(...)`
  - launches processes directly instead of routing through the deleted `runtime-shell` skill
  - stores run session state in memory and log files under `skill-host/state/run-sessions/`
  - separates “launch new run” from “inspect existing session”
  - only requires `session` when starting a new run
  - uses managed-runtime linker launching for Termux-based Node/Python runtimes
- `SkillRuntimePlugin.extractWebPage(...)`
  - creates a hidden WebView inside the native app
  - loads the target URL with JS enabled and shared CookieManager state
  - injects a DOM-to-Markdown extractor script from `android/app/src/main/assets/browser-page-extractor.js`
  - returns a structured browser-extraction payload to TypeScript

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
  - `DEFAULT_SKILL_CALL_SYSTEM_PROMPT` currently points at the same run prompt for storage/schema compatibility
  - active default examples in the top-level prompt docs were updated to show `<run>` instead of `<skill_call>`
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
  - webpage fetching is now direct HTML extraction only; the page-reader path no longer routes through `jina`
  - the skill frontmatter now advertises the two-step workflow explicitly: search for candidate links first, then visit the chosen URL for full page content
  - the skill networking layer now uses a reusable desktop Chromium Windows request profile for HTML and search traffic instead of the previous Android-mobile default headers
  - the request layer now maintains a per-process cookie jar and redirect-aware request headers so multi-step scraping behaves more like a real desktop browser session
  - `visit_url` now has a site-specific blocked-page fallback for Zhihu question URLs: when Zhihu returns the `zse-ck` challenge page, the skill returns a structured “访问受限” Markdown payload instead of surfacing a raw 403 exception
  - in native app builds, `visit_url` now defaults to browser mode through the hidden-WebView path; explicit `--extract html` is the escape hatch back to direct HTML fetching

## Built-In Skill Materialization

- `src/services/skills/host.ts` currently only materializes built-in skills from the repo bundles
- a sync pass now deletes built-in skill directories that are no longer present in the repo definition, so removed built-ins such as `runtime-shell` should not keep living on device after re-sync
