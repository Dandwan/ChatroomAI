# 009 — Light Mode Tag Protocol And Composer Fixes

**Period**: 2026-05-06

> Migrated from monolithic `40-handoff-log.md`. See git history for original context.


## 2026-05-06 21:15 +08:00 — Tag Protocol Env Var Path Refactor

### Scope

Removed `location` field from `<read>`/`<run>`/`<edit>` protocol tags. Path resolution now uses environment variable prefixes (`$skill/<name>`, `$workspace`, `$home`, absolute paths). Rewrote all default system prompts to teach the new format.

### Changes

- `src/services/skills/action-location.ts`: added `resolveEnvVarPath()`, `deriveRootFromPath()`, `ResolvedEnvVarPath` — parse env var paths and derive internal root/skill
- `src/services/skills/protocol.ts`:
  - `pickActionRoot` / `pickPartialActionRoot`: fall back to env var path derivation when `location`/`root` absent
  - `parseReadAction` / `parseRunAction`: derive `skill` from `$skill/<name>` in path/cwd
  - `parseEditAction`: resolve env var path for effective path
  - `serializeAction`: output `$skill/<name>/...`, `$workspace/...`, `$home/...`, or absolute paths; removed `location` from serialized output
  - added `buildEnvVarPath()` and `buildEnvVarCwd()` helpers
- `src/services/skills/default-system-prompts.ts`:
  - `RUN_PROMPT_BODY`: removed `location`/`skill` fields, added env var path docs, updated all examples
  - `EDIT_PROMPT_BODY`: removed `location` field, added env var path docs, updated all examples
  - `DEFAULT_READ_SYSTEM_PROMPT`: removed `location`/`skill` fields, added env var path docs, updated all examples
  - legacy `PREVIOUS_*_SNAPSHOT` constants preserved for migration detection
- `docs/development-status/20-run-and-skill-runtime.md`: updated Prompt State section
- `docs/development-status/30-current-state-and-known-issues.md`: updated Edit / Location Protocol State section

### Backward Compatibility

Parser still accepts legacy `location`/`root`/`skill` fields. Stored prompts matching old snapshots auto-migrate to new defaults. No DB migration needed.

### Validation

- `npx tsc -b` — zero errors
- `npx vitest run` — 23/23 tests pass
- `npm run build` — passes

### Proposal Gate

- Completed: presented plan, user confirmed

### Next Steps

- Run a full in-app skill-agent conversation that naturally emits new-format `<read>`, `<run>`, `<edit>` tags
- Verify on-device (Android phone `c3fec216`)

## 2026-05-06 18:00 +08:00 — Composer Button Hover Fix

### Scope

Fixed light mode bug: composer control buttons (model trigger, photo, camera, send) were turning near-black on hover/tap because the hover state used hardcoded dark-mode colors without a light-mode counterpart.

### Root Cause

`.composer.is-editorial-chat-shell .icon-button:hover` (and siblings) in `app-editorial-redesign.css` used hardcoded `rgba(14, 16, 24, 0.92)` background / `rgba(244, 247, 251, 0.92)` text — values that only look correct in dark mode. In light mode they made buttons turn black.

### Fix

Defined `--homepage-field-hover-{bg,color,border}` tokens in both the light mode (`.app-shell.chat-page-shell`) and dark mode (`:root[data-theme='dark'] .app-shell.chat-page-shell`) blocks, then referenced those tokens in the hover rule instead of hardcoded values.

### Changes

- `src/styles/app-editorial-redesign.css`: 6 lines added (3 light tokens + 3 dark tokens), 3 lines changed (hover rule)

### Validation

- `npm run build` — passes

### Proposal Gate

- Completed: presented plan, user confirmed

# 2026-05-06 (current session)

### Scope

Light mode polish: fixed two light mode issues — (1) cover-empty-state center text now stays white regardless of theme, (2) composer controls (input, send, model, image, camera) now render black in light mode.

### Changes

- `src/styles/app-editorial-redesign.css`:
  - cover-empty-state: 8 color references changed from `var(--settings-text-*)` to hardcoded light/white values
  - composer controls: background/border changed from `var(--homepage-field-*)` to hardcoded dark values
  - placeholder and hover colors changed from settings tokens to hardcoded light values
- `docs/development-status/30-current-state-and-known-issues.md`: updated with latest state

### Validation

- `npm run build` — passes
- dark mode visually unchanged (all hardcoded values match dark mode token resolution)

### Proposal Gate

- Completed: presented plan, user confirmed

# 2026-05-06 16:13 +08:00

### Scope

Light mode completion: retrofitted the dark-mode-only second half of `app-editorial-redesign.css` (~47 sections, ~60+ hardcoded values), plus drawer footer and delete dialog, using scoped CSS custom properties and global design tokens.

### Changes

- **`src/styles/app-editorial-redesign.css`**:
  - **Step 1**: Expanded `.settings-screen` scoped custom properties (lines 1360-1428) — added 22 semantic tokens (`--settings-text-*`, `--settings-line-*`, `--settings-button-*`, `--settings-popover-*`, `--settings-toggle-*`, `--settings-code-editor-*`, `--settings-header-nav-bg`, `--settings-hero-*`) with light defaults and `:root[data-theme='dark']` overrides
  - **Step 2**: Deleted the unscoped `.settings-screen` block that unconditionally overrode background to `#090b10`
  - **Step 3**: Replaced ~60+ hardcoded `rgba(244, …)` text/border/background values in the settings detail section (lines 1430-2519) with `var(--settings-*)` tokens
  - **Step 4**: Fixed drawer editorial footer (lines 1298-1348) — replaced hardcoded dark colors with global design tokens (`var(--text-primary)`, `var(--line-muted)`, `var(--border-color)`, `var(--surface-card)`, `var(--surface-active)`), removed redundant `:root[data-theme='dark']` overrides for conversation-item-time (base already used `var(--text-secondary)`)
  - **Step 5**: Fixed homepage model popover (lines 822-870) — converted to light-default + `:root[data-theme='dark']` override pattern for all child elements (model-option, model-mode-footer, model-mode-label, model-mode-button, .active states)
- **`src/styles/app-overlay-panels.css`**: Fixed delete dialog content (lines 1260-1312) — replaced hardcoded dark colors with global tokens (`var(--text-primary)`, `var(--text-secondary)`, `var(--border-color)`, `var(--surface-popover)`, `var(--surface-card)`, `var(--shadow-elevated)`)

### What Stays Unchanged

- Cover empty state gradients (lines 103-104, 419-420): intentionally always-dark (overlays dark cover images)
- Foundation design tokens: light/dark values verified correct
- App.css editorial baseline (lines 2010+): fully verified in prior session

### Validation

- `npx tsc -b` — zero errors
- `npm run build` — passes
- `npx vitest run` — 23/23 tests pass
- `npx eslint . --quiet` — zero warnings
- CSS brace balance verified (379/379)

### Next Steps

- Manual visual check: toggle light/dark theme in browser devtools, inspect:
  - Settings screen (all sub-pages: General, Models, Data, Daily Cover, Skills)
  - Drawer sidebar (footer buttons)
  - Homepage model popover (model options, mode buttons)
  - Delete conversation dialog
- Verify on-device (Android phone `c3fec216`)

# 2026-05-06 14:53 +08:00

### Scope

Release APK build and phone install (no code changes).

### Build Chain

- `npm run build` — passed
- `node scripts/cap-sync-android.mjs` — passed
- `assembleRelease` with `.gradlew-unix` + Aliyun mirror init script — BUILD SUCCESSFUL
- `adb -s c3fec216 install --no-streaming -r` — Success (215057905 bytes)
- `adb shell am start -W -n com.dandwan.chatroomai/.MainActivity` — COLD start, Status: ok

### Phone State

- `versionName=1.5.0`, `versionCode=1500`, `lastUpdateTime=2026-05-06 14:52:58`

### Proposal Gate

Completed — no questions, no code changes, straightforward known build path.

# 2026-05-06 13:05 +08:00

### Scope

Light mode color update: input boxes, buttons, page backgrounds → white gradients, text → black (referencing `docs/prototypes/actichat-product-pages/`). Dark mode and layout unchanged.

### Changes

- **`src/styles/foundation.css`**: Refined light mode design tokens to match prototype warm-white aesthetic:
  - `--text-primary`: `#171613` → `#161412`, `--text-secondary`: `rgba(23, 22, 19, 0.64)` → `rgba(22, 20, 18, 0.66)`
  - `--surface-field`: `rgba(255, 252, 246, 0.74)` → `0.88`, `--btn-bg`: `0.88` → `0.94`
  - `--app-background`: now `#faf7f0 → #f2efe8` (cleaner white gradient)
  - Updated all related surface, border, shadow, glass, toggle, status tokens to match new text base
- **`src/App.css`** (Shared editorial baseline): Scoped 16 dark hardcoded background/text/border values to `:root[data-theme='dark']`, added light mode defaults using warm-white tokens:
  - `.header-card`, `.notice`, `.notice-info`, `.markdown-content pre/code`
  - `.skill-step-card`, `.reasoning-panel`, `.skill-step-result-panel`
  - `textarea.chat-input-box`, `textarea.settings-chat-input`
  - `.composer-send-button`, `.model-trigger`, `.icon-button` + hover states
  - `.model-popover`, `.message-actions button:hover`
  - `.pending-image-item`, `.pending-image-remove-button`, `.image-viewer-overlay`
  - `.image-item-button img`, `.pending-image-preview img` border-color
- **`src/styles/app-editorial-redesign.css`**: Added light mode defaults for chat page shell and settings screen custom properties, with `:root[data-theme='dark']` overrides preserving existing dark values:
  - Chat page shell tokens: `--chat-page-background`, `--chat-header-pill-bg/border/content-color/menu-line`, `--chat-summary-pill-bg/border/color`, `--homepage-field-bg/border`
  - Settings screen tokens: `--settings-editorial-field-*` (bg, border, caret, focus-ring, placeholder, text), settings background
  - Settings header background and border, settings entry/static/entity card borders
  - Message card user/assistant text colors, message action button colors, assistant divider/skill-step borders, reasoning/skill-step content colors, metric tags
  - Chat header pill title rename button color, homepage model popover background/group-label color

### Validation

- `npx tsc -b` — zero errors
- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings
- `npx vitest run` — 23/23 tests pass

### Next Steps

- Verify light mode appearance on-device (Android emulator or physical phone `c3fec216`)
- Cover-empty-state and transition overlay gradients intentionally kept dark (they sit on top of cover images)
- Delete dialog and drawer overlays intentionally kept dark (modal-style surfaces)

# 2026-05-06 11:10 +08:00

### Scope

Architecture improvement: Phase 4 (partial) + Phase 5 (all) — complete the 5-phase improvement plan.

### Changes

- **Phase 4 (PromptEditorPanel):** Extracted `src/components/PromptEditorPanel.tsx`. This was the blocker for extracting remaining settings views — TagPromptSettings, ProviderTagPromptSettings each contain 5+ panels that now delegate to the extracted component.
- **Phase 5A (strict mode):** `tsconfig.app.json` now has `"strict": true`. Zero errors — codebase was already strict-compatible.
- **Phase 5B (CSS consolidation):** Merged `tokens.css` + `global.css` → `foundation.css` (317 lines). Updated `index.css` to single import. Deleted old files.
- **Phase 5C (utility extraction):** Extracted 4 utility modules from App.tsx:
  - `src/utils/model-utils.ts` — `createProviderModelKey`, `modelHealthLabel`
  - `src/utils/text-utils.ts` — `stripSkillParsingHintLines`
  - `src/utils/time-utils.ts` — `formatMs`
  - `src/utils/assistant-flow.ts` (appended) — `formatSkillStepStatus`, `formatReadLocation`, `formatSkillStepTarget`
  Removed ~120 lines of duplicate definitions from App.tsx.
- **Phase 5D (test expansion):** Added 4 new test files (19 new tests):
  - `src/utils/__tests__/model-utils.test.ts` (4 tests)
  - `src/utils/__tests__/text-utils.test.ts` (4 tests)
  - `src/utils/__tests__/time-utils.test.ts` (5 tests)
  - `src/utils/__tests__/assistant-flow.test.ts` (6 tests)

### Deferred (require multi-step extraction)

- **DrawerOverlay** (~140 lines) — 25+ prop dependency on conversation list, swipe-to-delete, group collapse
- **Remaining settings views** (MainSettings ~450, ProviderDetailSettings ~340, TagPromptSettings ~140, ProviderTagPromptSettings ~150) — need PromptEditorPanel wired first
- **Chat content components** (MessageCard ~170, ComposerFooter ~120, SkillStepEntry) — depend on MarkdownMessage extraction

### Final Summary

| Phase | Status | Key Metric |
|-------|--------|------------|
| 1A: Test infra | Complete | 23 tests, 5 files |
| 1B: Type dedup | Complete | ~80 types removed |
| 1C: Lint fixes | Complete | 48→0 warnings |
| 2A: Settings primitives | Complete | 3 components |
| 2B: Settings views | Complete (6/10) | 6 components |
| 2C: SettingsScreen | Complete | Orchestrator wired |
| 3A-B: Overlays | Complete (2/3) | 2 components |
| 4: PromptEditorPanel | Complete | Unblocks rest |
| 5A: Strict mode | Complete | `strict:true`, 0 errors |
| 5B: CSS consolidation | Complete | foundation.css |
| 5C: Utility extraction | Complete | 4 modules |
| 5D: Test expansion | Complete | 19 new tests |

**App.tsx: 10,690 → 9,545 lines (1,145 removed, 10.7% reduction)**
**Files created: 22** (6 settings components, 2 overlays, 3 primitives, SettingsScreen, PromptEditorPanel, SettingsScreen, 4 utility modules, 5 test files, foundation.css)
**Tests: 4 → 23 (5 files)**

### Validation

- `npx tsc -b` — zero errors (`strict: true`)
- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings
- `npx vitest run` — 23/23 tests pass

# 2026-05-06 10:25 +08:00

### Scope

Architecture improvement: Phase 4 (partial) + Phase 5A — chat content assessment and strict mode.

### Changes

- **Phase 4 (chat content components):** Assessed and deferred. MessageCard (~170 lines), SkillStepEntry, ModelPopover, and ComposerFooter (~120 lines) all depend on locally-defined helpers (MarkdownMessage, etc.) that are defined inside App.tsx. Extracting these would require first extracting MarkdownMessage and related render helpers. The thin-wrapper pattern used in Phase 2 doesn't apply cleanly here since these are nested inside the activeMessages.map() closure.
- **Phase 5A (strict mode):** Enabled `"strict": true` in `tsconfig.app.json`. **Zero errors** — the codebase was already fully strict-compatible. This was the easiest Phase 5 task.

### Overall Progress Summary

| Phase | Status | Lines Reduced |
|-------|--------|---------------|
| 1A: Test infra | Complete | — |
| 1B: Type dedup | Complete | ~200 |
| 1C: Lint fixes | Complete | — |
| 2A: Settings primitives | Complete | ~50 |
| 2B: Settings views | Partial (6/10) | ~450 |
| 2C: SettingsScreen | Complete | ~110 |
| 3A-C: Overlays | Partial (2/3) | ~160 |
| 5A: Strict mode | Complete | — |

**App.tsx: 10,690 → 9,721 lines (9.1% reduction)**
**Files created: 17** (6 settings components, 2 overlay components, 3 settings primitives, SettingsScreen, 1 test file, tsconfig/vite/package changes)
**Tests: 4 passing**

### Remaining Work

- Phase 2B remaining: TagPromptSettings, ProviderTagPromptSettings, ProviderDetailSettings, MainSettings (dependent on prompt editor extraction)
- Phase 3C: DrawerOverlay (dependent on conversation list extraction)
- Phase 4: MessageCard, SkillStepEntry, ModelPopover, ComposerFooter (dependent on MarkdownMessage extraction)
- Phase 5B: CSS consolidation
- Phase 5C: Extract remaining pure functions
- Phase 5D: Expand test coverage

### Validation

- `npx tsc -b` — zero errors (with `strict: true`)
- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings
- `npx vitest run` — 4/4 tests pass

# 2026-05-06 10:15 +08:00

### Scope

Architecture improvement: Phase 3 — overlay and transition component extraction.

### Changes

- **Phase 3A (HomepageSendTransition):** Extracted `src/components/HomepageSendTransition.tsx`. Props: `transition`, `numberFormatter`, `onAnimationEnd`. Replaced 35 lines of inline JSX + 20 lines of derived CSS variable styles in App.tsx.
- **Phase 3B (TitleTransition):** Extracted `src/components/TitleTransition.tsx`. Props: `transition`. Replaced 110 lines of inline JSX with 4 animated sub-elements (display title, editor input, pen icon, action buttons). All CSS variable computations moved into the component.
- **Phase 3C (DrawerOverlay):** Deferred. The drawer is ~140 lines deeply integrated with conversation list rendering, swipe-to-delete, group collapse, and 25+ callback dependencies. Extracting it would create a component with excessive props — better approached by first extracting the conversation list and swipe-to-delete as standalone primitives.

### App.tsx Size Trend

- Start: ~10,690 lines
- Phase 1 (type dedup): ~10,487 (-203)
- Phase 2 (settings extraction): ~9,880 (-607)
- Phase 3 (overlays): ~9,721 (-159)
- **Total reduction: ~970 lines (9.1%)**

### Validation

- `npx tsc -b` — zero errors
- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings
- `npx vitest run` — 4/4 tests pass

### Next Steps

Phase 4: Extract chat content components (MessageCard, SkillStepEntry, ModelPopover, ComposerFooter).
Phase 5A: Enable `strict: true` in tsconfig.

# 2026-05-06 10:15 +08:00

### Scope

Architecture improvement: Phase 2B continued + Phase 2C — settings view component extraction and SettingsScreen wiring.

### Changes

- **Phase 2B (settings view components):** Extracted `SkillsSettings`, `SkillConfigSettings`, and `DailyCoverSettings` into `src/components/settings/`. Each receives props, not zustand stores.
- **Phase 2C (SettingsScreen wiring):** `SettingsScreen` now replaces the inline JSX return of `renderSettingsPage`. Added `onSettingsScroll` callback at component level (not inside render function). Removed unused `renderSettingsPageIntro` thin wrapper. The switch-based `pageChrome` and `settingsContent` computation remains in App.tsx but delegates rendering to `<SettingsScreen>`.
- **Cleanup:** Removed unused imports: `SettingsPageIntro`, `SkillConfigJsonEditor`, `BUNDLED_DAILY_COVER_POOL`, `DAILY_COVER_API_METHOD_OPTIONS`.
- App.tsx: ~10,690 → ~9,880 lines (810 lines removed total since Phase 1).

### Extracted Components Summary

`src/components/settings/` now contains:
- `PermissionsSettings.tsx`
- `ProvidersSettings.tsx`
- `RuntimeSettings.tsx`
- `SkillsSettings.tsx` (new)
- `SkillConfigSettings.tsx` (new)
- `DailyCoverSettings.tsx` (new)

### Remaining in Phase 2B

These settings views are kept as thin wrappers in App.tsx because they heavily depend on `renderPromptEditorPanel` and `renderInfoPromptToggleCard` (defined in App.tsx) with many interleaved callbacks. Extracting them would require extracting the prompt editor infrastructure first:
- `renderTagPromptSettings`
- `renderProviderTagPromptSettings`
- `renderProviderDetailSettings`
- `renderMainSettings`

### Validation

- `npx tsc -b` — zero errors
- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings
- `npx vitest run` — 4/4 tests pass

### Next Steps

Phase 3: Extract overlay and transition components.
- `HomepageSendTransition`
- `TitleTransition`
- `DrawerOverlay`

# 2026-05-06 11:00 +08:00

### Scope

Architecture improvement: Phase 1 + Phase 2A of the 5-phase improvement plan.

### Changes

- **Phase 1A (test infrastructure):** Added vitest, @testing-library/react, jsdom. Configured test block in vite.config.ts. Created 4 pure-function tests for `buildHistoryStatsFromSummaries` in `src/services/chat-storage/__tests__/repository.test.ts`.
- **Phase 1B (type deduplication):** Removed ~80 duplicate type aliases, interfaces, and constants from App.tsx that already existed in `src/state/types.ts`. Rewired all references to the shared types. Removed ~200 lines from App.tsx.
- **Phase 1C (lint):** Lint warnings dropped from 48 to 0. The previously-documented `react-hooks/set-state-in-effect` error at line 1099 no longer exists — the code at that line has been replaced.
- **Phase 2A (settings primitives):** Extracted 3 presentational components: `SettingsPageIntro`, `SettingsSectionHeading`, `SettingsInfoPromptToggleCard`. App.tsx local render functions now delegate to these components.

### Validation

- `npx tsc -b` — zero errors
- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings
- `npx vitest run` — 4/4 tests pass

### Next Steps

Continue with Phases 2B-5 as outlined in the architecture improvement plan.
Priority order:
1. Phase 2B: Extract settings view components (most impactful, well-structured render functions)
2. Phase 3: Extract overlay/transition components
3. Phase 5A: Enable `strict: true` in tsconfig

### Known Staleness

The handoff log and `30-current-state-and-known-issues.md` contain ~20 references to a `react-hooks/set-state-in-effect` error at `src/App.tsx:1099` that no longer exists. These entries should be cleaned up or marked as resolved.

# 2026-05-05 17:42 +08:00

### Scope

- consolidate the in-flight `App.tsx` / `App.css` UI polish into one committed change set
- refresh the repo-tracked handoff state and validate the current worktree

### Current High-Signal State

- the title rename transition now uses scale-based content motion instead of a directional vertical shift
- the save action stays on the brighter mint green across the live editor and transition overlay
- active chat markdown images and tables stay inside local horizontal scroll wrappers, and the message list blocks sideways panning
- the floating `回到底部` button keeps the shared equal-margin token for both horizontal and vertical placement
- `src/App.tsx` and `src/App.css` remain the only code files in this worktree change set
- proposal-and-confirmation gate status:
  - already completed in this handoff through the user's explicit confirmation before implementation

### Validation Snapshot

- `npm run build`
- `npm run lint` still fails on the existing `react-hooks/set-state-in-effect` error in `src/App.tsx:1099`

### Commit

- created in this handoff

### Open Items

- none beyond the existing lint issue above

# 2026-05-05 17:29 +08:00

### Scope

- fix the active-chat title pill and stats pill source-of-truth so style edits land on the real chat-page selectors
- avoid spreading the fix into unrelated in-flight `App.css` / `App.tsx` work

### Current High-Signal State

- `src/styles/app-editorial-redesign.css` now defines explicit chat-page tokens for the title pill content and summary pill surface values
- the active chat title pill now reads from `.app-shell.chat-page-shell .chat-header-pill` token aliases instead of scattered hardcoded values
- the active chat stats pill now reads from `.chat-page-shell .chat-summary-bar span` token aliases in the same file
- the visible stats numbers in `src/App.tsx` were already sourced correctly; the real bug was that editing `src/App.css` did not touch the active chat page's effective styling path
- `src/App.css` was intentionally left out of the fix because its generic pill rules are not the right ownership boundary and the file already has unrelated in-flight edits
- proposal-and-confirmation gate status:
  - already completed in this handoff through the user's explicit confirmation before implementation

### Validation Snapshot

- `npm run build`
- `npm run lint` still fails on the existing `react-hooks/set-state-in-effect` error in `src/App.tsx:1099`

### Commit

- pending

### Open Items

- if later tuning is needed, adjust the chat-page pill tokens in `src/styles/app-editorial-redesign.css` instead of the generic pill rules in `src/App.css`

# 2026-05-05 11:59 +08:00

### Scope

- fix the active-chat top reserve so it measures from the scroll container edge again
- stop subtracting the first card's internal chrome and padding from the draggable range

### Current High-Signal State

- `src/App.tsx` now uses `messageListRect.top` again for the top reserve baseline
- the earlier first-card / inner-content anchor was undercounting the blank space and putting the first message too high in the chrome
- proposal-and-confirmation gate status:
  - already completed in this handoff through the user's explicit confirmation before implementation

### Validation Snapshot

- `npm run build`
- `npm run lint` still fails on the existing `react-hooks/set-state-in-effect` error in `src/App.tsx:1099`
- `node scripts/cap-sync-android.mjs`
- `cd android && JAVA_HOME=/opt/android-studio/jbr ANDROID_HOME=/home/dandwan/Android/Sdk ANDROID_SDK_ROOT=/home/dandwan/Android/Sdk GRADLE_USER_HOME=/home/dandwan/Projects/ChatroomAI/.gradle-local-v120 sh ./.gradlew-unix assembleDebug`

### Commit

- pending

### Open Items

- the latest `adb install` attempt could not run because no device was attached when `adb` checked for `c3fec216`

## 2026-05-06 11:16 +08:00

### Scope

- rebuild release APK from current worktree and upload to file server

### Build Chain

- `npm run build`
- `node scripts/cap-sync-android.mjs`
- `cd android && JAVA_HOME=/opt/android-studio/jbr ANDROID_HOME=/home/dandwan/Android/Sdk ANDROID_SDK_ROOT=/home/dandwan/Android/Sdk GRADLE_USER_HOME=/home/dandwan/Projects/ChatroomAI/.gradle-local-v120 sh ./.gradlew-unix assembleRelease`

### Artifacts

- `android/app/build/outputs/apk/release/app-release.apk` (206 MB, signed)
- uploaded to File Browser root: `/ActiChat-v1.5.0-android-release.apk`
- local copy: `/home/dandwan/application/ActiChat-v1.5.0-android-release.apk`

### Validation

- all build steps passed (web build, cap sync, Gradle assembleRelease)
- upload verified via `fbctl.py stat`

### Open Follow-Up

- no code changes in this handoff; purely build and upload