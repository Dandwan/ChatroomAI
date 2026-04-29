# Handoff Log

## 2026-04-29 15:07 +08:00

### Scope

- version the repository for `v1.5.0`
- build a signed Android release APK
- push the release branch to GitHub and publish a new GitHub release

### Current High-Signal State

- release branch pushed:
  - `origin/release-v1.5.0`
- GitHub release published:
  - `https://github.com/Dandwan/ChatroomAI/releases/tag/v1.5.0`
- version fields now aligned to `1.5.0` / `1500`
- signed release artifact created locally:
  - `ActiChat-v1.5.0-android-release.apk`

### Validation Snapshot

- `npm run android:build:release` with repo-local Gradle home
- `apksigner verify --print-certs android\\app\\build\\outputs\\apk\\release\\app-release.apk`
- `Get-FileHash ActiChat-v1.5.0-android-release.apk -Algorithm SHA256`
- `git push -u origin release-v1.5.0`
- `gh release create v1.5.0 ActiChat-v1.5.0-android-release.apk --target release-v1.5.0 --title "ActiChat v1.5.0" --notes-file docs/releases/v1.5.0.md --latest`

### Open Follow-Up

- if you want this release branch merged back into `origin/main`, handle that as a separate integration step because the local starting point was behind the remote default branch at the start of this handoff

## 2026-04-29 10:53 +08:00

### Scope

- upload the latest debug APK to the user's File Browser server root

### Current High-Signal State

- uploaded source artifact:
  - `android/app/build/outputs/apk/debug/app-debug.apk`
- remote destination:
  - `/ActiChat-v1.3.0-debug-20260429-105201.apk`
- remote `stat` confirmed the file exists with size `212355452` bytes

### Validation Snapshot

- `python ...filebrowser_ops.py upload C:\\Users\\Dandwan\\projects\\ChatroomAI\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk /ActiChat-v1.3.0-debug-20260429-105201.apk`
- `python ...filebrowser_ops.py stat /ActiChat-v1.3.0-debug-20260429-105201.apk`

### Open Follow-Up

- if you want release-signed rather than debug APK uploads again, build a fresh release artifact and upload it with a separate filename

## 2026-04-29 10:35 +08:00

### Scope

- split the previously merged run/edit tag prompt configuration back into separate run and edit prompt fields
- add a dedicated edit tag prompt panel and provider override panel
- keep the newer `location` / `root` terminology while reverting the run prompt body to run-only guidance

### Current High-Signal State

- `App.tsx` now treats `editSystemPrompt` as a first-class global/provider prompt setting alongside `readSystemPrompt` and `skillCallSystemPrompt`
- the settings UI now exposes separate panels for:
  - `<read>`
  - `<run>`
  - `<edit>`
- `default-system-prompts.ts` now exports a dedicated `DEFAULT_EDIT_SYSTEM_PROMPT`
- legacy settings migration now splits the previously combined run/edit default prompt into:
  - run-only `skillCallSystemPrompt`
  - edit-only `editSystemPrompt`

### Validation Snapshot

- `npm run build` passed
- `npm run lint` passed
- `node scripts/cap-sync-android.mjs` passed
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug` passed

### Open Follow-Up

- if you want the physical phone to reflect this latest settings-UI split immediately, reinstall the newest debug APK onto `c3fec216`

## 2026-04-29 10:04 +08:00

### Scope

- install the latest debug APK onto the connected physical phone through `adb`

### Current High-Signal State

- physical device `c3fec216` was connected and available through the repo's known-good SDK `adb.exe`
- the current debug artifact `android/app/build/outputs/apk/debug/app-debug.apk` installed successfully using the previously documented `--no-streaming -r` workaround path
- launching `com.dandwan.chatroomai/.MainActivity` succeeded; Android reported that the existing task was brought to the front

### Validation Snapshot

- `C:\\Users\\Dandwan\\scoop\\apps\\android-clt\\14742923\\platform-tools\\adb.exe devices -l`
- `C:\\Users\\Dandwan\\scoop\\apps\\android-clt\\14742923\\platform-tools\\adb.exe -s c3fec216 install --no-streaming -r android\\app\\build\\outputs\\apk\\debug\\app-debug.apk`
- `C:\\Users\\Dandwan\\scoop\\apps\\android-clt\\14742923\\platform-tools\\adb.exe -s c3fec216 shell am start -n com.dandwan.chatroomai/.MainActivity`

### Open Follow-Up

- if the user wants the newly added `<edit>` flow exercised on the physical phone, run one real in-app conversation and capture either internal debug logs or WebView DevTools state

## 2026-04-29 09:55 +08:00

### Scope

- implement the new `<edit>` host action end-to-end
- migrate protocol-facing path naming from `root` / `absolute` toward canonical `location` / `root`, while preserving old input compatibility
- extend `<read>` to `home` and native absolute paths, update default system prompts, and validate the new native file-access path on Android

### Current High-Signal State

- protocol parsing now recognizes `<edit>` and normalizes legacy incoming `root` / `absolute` into the new external contract `location` / `root`
- `src/services/skills/text-edit.ts` now owns snapshot-based line edit semantics including `expectedText`, atomic application, and grouped preview snippets
- `src/services/skills/location-files.ts` now centralizes `read` / `edit` backends across `skill`, `workspace`, `home`, and native absolute paths
- `SkillRuntimePlugin.java` now exposes absolute-path directory list, stat, text-read, and text-write primitives for native `location="root"` support
- host transcript categories now include `edit_result` / `edit_error`
- default prompt text now teaches `<edit>` and `location` / `root`

### Validation Snapshot

- `npm run build` passed
- `npm run lint` passed
- `node scripts/cap-sync-android.mjs` passed
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug` passed
- headless emulator launch via `.codex/skills/chatroomai-android-emulator-test/scripts/launch-emulator.ps1` passed
- emulator attach via `.codex/skills/chatroomai-android-emulator-test/scripts/attach-running-emulator.ps1 -Port 5554` passed
- app install/start via `.codex/skills/chatroomai-android-emulator-test/scripts/prepare-chatroomai.ps1` passed
- WebView DevTools smoke on `emulator-5554` passed for:
  - reading `/system/etc/hosts`
  - writing and reading back `/data/data/com.dandwan.chatroomai/files/skill-host/home/edit-smoke/location-root-test.txt`
  - listing the absolute parent directory and observing the created file
- temporary `npx --yes tsx` smoke scripts passed for:
  - `<edit>` protocol parsing / normalization
  - `applyTextEdits(...)` line-edit behavior and preview generation

### Open Follow-Up

- run a true in-app model round that emits `<edit>` from the normal chat loop, not only direct smoke invocations of protocol/helpers/native plugin methods
- decide whether full protocol-facing rename should eventually continue from internal `root` / `absolute` storage names to internal `location` / `root`, or whether the current compatibility boundary is sufficient long-term

## 2026-04-29 09:14 +08:00

### Scope

- answer follow-up questions about the current meaning of `absolute` in existing tags
- evaluate whether the new edit protocol should keep the current `root` field name or migrate to `location`
- record the user’s latest direction on native-only planning and symmetric read support

### Current High-Signal State

- today only `<run>` supports the enum value `absolute`; `<read>` does not
- existing `<run root=\"absolute\">` semantics are “absolute-path working-directory mode”, not “implicitly operate from system `/`”
- if `root=\"absolute\"` is used without `cwd`, current run code falls back to the app home absolute path rather than the system root
- the user now wants `<read>` widened symmetrically and is only concerned with native usage for this feature planning

### Validation Snapshot

- no build or lint command was run in this investigation-only handoff
- inspected:
  - `src/services/skills/types.ts`
  - `src/services/skills/protocol.ts`
  - `src/services/skills/default-system-prompts.ts`
  - `src/services/skills/run-executor.ts`
  - `src/services/skills/run-resolver.ts`

### Open Follow-Up

- decide whether to preserve protocol compatibility by keeping the existing field name `root`, or to perform a wider rename to `location` across `read` / `run` / `edit`
- if the rename happens, decide whether the parser should accept both old and new spellings during transition
- decide whether the enum value currently called `absolute` should stay for cross-action consistency or be renamed to `root` / similar for semantic clarity

## 2026-04-28 23:46 +08:00

### Scope

- continue requirements analysis for a new `<edit>` protocol tag
- trace the current tag parser, execution loop, assistant-flow UI, and workspace file primitives
- identify what is already reusable versus what must be added for line-based file editing

### Current High-Signal State

- executable protocol tags are currently limited to `<read>`, `<run>`, and legacy `<skill_call>` in `src/services/skills/protocol.ts`
- the round executor in `src/App.tsx` only dispatches `read`, `run`, and `skill_call`, and only these kinds are represented in assistant flow nodes
- workspace text-file reads are implemented today, and low-level Capacitor filesystem write/delete helpers exist, but there is no conversation-workspace edit API with line-range validation or edit-result envelopes
- a future `<edit>` tag should be treated as a new host capability, not as a thin alias over current message-edit UI

### Validation Snapshot

- no build or lint command was run in this investigation-only handoff
- additionally inspected:
  - `src/services/skills/protocol.ts`
  - `src/services/skills/executor.ts`
  - `src/services/skills/types.ts`
  - `src/services/read-utils.ts`
  - `src/services/chat-storage/filesystem.ts`
  - `src/utils/assistant-flow.ts`

### Open Follow-Up

- decide the v1 scope of `<edit>` roots: `workspace` only, or also wider path roots
- decide the v1 operation model: line-based `insert` / `delete` / `replace` only, or also file create / append / rename
- decide the exact payload shape and result/error schema before implementation starts

### User Direction Received After This Handoff

- roots should support `workspace`, `home`, and system-root access
- new-file creation is required
- edits should be applied atomically against one original snapshot
- `insert` should accept either `beforeLine` or `afterLine`
- all edit ops should support optional `expectedText`
- edit results should include preview output as snippets grouped around modification points
- do not use the enum value `root`; keep the existing field name convention if possible, but prefer a clearer system-root value

### Additional Constraint Identified

- current storage helpers are built on `Directory.Data` plus relative-path validation, so true system-root editing cannot reuse the existing safe relative-path write helpers as-is and will require a separate absolute-path-capable implementation path
- exposing `<edit>` on `home` / system-root without also widening `<read>` would leave the model without an equivalent inspect-first path on those roots
- system-root editing will likely need platform gating or explicit unsupported behavior outside native environments

## 2026-04-28 23:35 +08:00

### Scope

- inspect the current `edit` implementation before making any feature changes
- trace message edit, title edit, transcript projection, and persistence behavior
- prepare an implementation plan with constraints and open questions for the user instead of changing product code yet

### Current High-Signal State

- chat-message edit lives in `src/App.tsx` and operates on projected message cards, not a 1:1 transcript-event editor
- assistant reply edit currently replaces the full assistant turn with a single static assistant event, which means tool/host detail for that turn is discarded on save
- user reply edit already supports two distinct semantics: edit in place, or edit and resend from that turn
- title derivation remains transcript-driven unless `titleManuallyEdited` is already true

### Validation Snapshot

- no build or lint command was run in this investigation-only handoff
- inspected:
  - `src/App.tsx`
  - `src/services/chat-transcript/projection.ts`
  - `src/services/chat-storage/repository.ts`
  - `docs/chat-storage-spec.md`
  - `docs/development-status/*.md`

### Open Follow-Up

- confirm which `edit` surface the user wants changed: user message, assistant message, conversation title, or another editor
- decide whether assistant edit should remain a destructive turn rewrite, become a safer override model, or be constrained to simpler cases
- decide whether user-message edit should support attachment changes and whether transcript-only edits should keep logically stale downstream replies

## 2026-04-28 20:48 +08:00

### Scope

- rename the product branding to `动话` in Chinese user-facing surfaces and `ActiChat` in English-facing project/config surfaces
- update web metadata, in-app headings, Capacitor config, Android app-name resources, and project package metadata
- keep the existing Android package identifier unchanged to avoid breaking installs and updates

### Current High-Signal State

- web-facing title/metadata now use the new `动话` / `ActiChat` branding
- in-app fallback titles and empty-state branding in `src/App.tsx` now show `动话`
- Android default app name is now `ActiChat`, with a `values-zh` override so Chinese devices show `动话`
- `package.json` / `package-lock.json` package name now use `actichat`
- Gradle root project name is now `ActiChat`
- `com.dandwan.chatroomai` remains unchanged on purpose

### Validation Snapshot

- source-level rename pass completed across web, Capacitor, Android resources, README, and development-status docs
- no build or sync command was run in this handoff

### Open Follow-Up

- if the repo directory name, remote repository name, APK artifact naming, or Java package path also need to move from `ChatroomAI`, handle that as a separate migration because it affects build/release/update compatibility
- run `npm run build` and `npm run android:sync` before the next packaged Android build so generated assets pick up the new branding

## 2026-04-28 13:01 +08:00

### Scope

- extend the built-in `union-search` skill with an explicit webpage-visit entrypoint and richer Markdown page extraction
- remove `jina` from the page-reading path and steer the model toward a mandatory search-then-visit workflow
- validate the new flow locally, through Android asset sync, and through emulator install/start smoke checks

### Current High-Signal State

- `union-search` now has a first-class `visit_url` wrapper; `fetch_url` remains as a compatibility alias
- page fetching now uses direct HTML extraction and returns richer structured payloads: Markdown body, metadata, headings, links, and images
- the skill frontmatter and active run prompt now both tell the model that search results are only candidate links, not webpage正文
- the built Android asset bundle contains the updated `union-search` skill definition and prompt text

### Validation Snapshot

- `node --check builtin-skills/union-search/scripts/lib/union-search.cjs` passed
- `node --check builtin-skills/union-search/scripts/lib/page-fetch.cjs` passed
- `node builtin-skills/union-search/scripts/run-union-search.cjs visit_url.internal --url https://example.com` passed
- temporary localhost HTTP page validation for `visit_url` passed
- `npm run lint` passed
- `npm run build` passed
- `node scripts/cap-sync-android.mjs` passed
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug` passed
- emulator launch via `chatroomai-android-emulator-test` passed in headless mode
- `prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI` installed and started the debug app on `emulator-5554`

### Open Follow-Up

- if user-facing behavior still misses `visit_url` in real conversations, inspect whether existing saved prompts/providers are overriding the new active defaults
- if higher-fidelity webpage conversion is needed later, consider adding a browser-rendered extraction mode separately from the new direct HTML path
- decide whether the explicit `jina` search provider should stay as disabled dead code or be removed completely in a future cleanup

## 2026-04-28 14:06 +08:00

### Scope

- run a real app-side conversation regression for the new `search -> visit_url` workflow
- verify not just standalone scripts but the in-app prompt, model call, and host-action chain
- isolate any runtime blockers that still prevent the workflow from succeeding on emulator

### Current High-Signal State

- on the x86_64 emulator, the app-side model request included the updated `skillCallSystemPrompt` guidance and the updated `union-search` skills catalog
- a real mocked provider-driven conversation inside the app reached a first-round `<progress>` with `./web_search ... --markdown`, then a second-round `<progress>` with `./visit_url --url "https://example.com"`, which confirms the desired action-selection path
- both run actions failed on `emulator-5554` because the installed Node runtime binary is AArch64 while the emulator ABI is x86_64
- an attempt to switch to the existing `ChatroomAI_API_35_ARM64` AVD did not reach `adb` attach, both through the repo-local skill launcher and a direct emulator invocation

### Validation Snapshot

- WebView DevTools inspection confirmed the active request prompt included the new `visit_url` guidance
- WebView DevTools inspection confirmed the active skills catalog exposed `union-search` capability metadata including `visit_url`
- in-app mocked-provider regression produced:
  - round 1 `progress` with `./web_search --query "Example Domain" --site example.com --limit 3 --markdown`
  - round 2 `progress` with `./visit_url --url "https://example.com"`
- host-side `run_error` payloads showed the concrete blocker:
  - `.../nodejs-termux-aarch64/bin/node` is for `EM_AARCH64 (183)` instead of `EM_X86_64 (62)`
- ARM64 emulator launch attempts did not attach to `adb`, so no successful arm64-side rerun was completed in this handoff

### Open Follow-Up

- if emulator execution coverage matters, either package an x86_64 Node runtime or get the ARM64 AVD booting reliably on this machine
- once one of those runtime paths is available, rerun the same mocked-provider conversation to confirm `web_search` and `visit_url` both execute successfully, not merely get selected

## 2026-04-28 14:17 +08:00

### Scope

- build a fresh signed Android release APK from the current worktree
- upload the resulting artifact to the user's remote File Browser cloud drive using the repo-available skill workflow

### Current High-Signal State

- `npm run android:build:release` succeeded with the existing release keystore configuration in `android/keystore.properties`
- the generated release artifact was copied to a timestamped top-level filename before upload to avoid overwriting older cloud artifacts
- the uploaded remote path is `/ChatroomAI-v1.3.0-android-release-20260428-141702.apk`

### Validation Snapshot

- local release build command:
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:build:release`
- local artifact copy:
  - `ChatroomAI-v1.3.0-android-release-20260428-141702.apk`
- remote upload command:
  - `python ...filebrowser_ops.py upload <local-apk> /ChatroomAI-v1.3.0-android-release-20260428-141702.apk`
- remote `stat` confirmed the uploaded file exists with size `210715678` bytes

### Open Follow-Up

- if the user wants a versioned release naming scheme aligned with future app version bumps, update `android/app/build.gradle` and `package.json` before the next signed upload

## 2026-04-28 15:06 +08:00

### Scope

- refactor `union-search` networking to use maintainable desktop Chromium Windows request headers instead of the old Android-mobile defaults
- add per-process cookie/redirect session handling to make search and page fetches behave more like real browser traffic
- sync the updated built-in skill assets back into the Android project

### Current High-Signal State

- `union-search` now routes requests through a dedicated request-client module instead of hardcoding raw headers in `union-search.cjs`
- default browser traffic now uses a desktop Chromium Windows profile with browser-like `User-Agent`, `Accept`, `Accept-Language`, client hints, and `sec-fetch-*` fields
- the request client also maintains cookies across redirects and subsequent requests within a single skill process
- Android assets were re-synced after the built-in skill change, but no new emulator execution pass was run because the previously identified x86_64 vs AArch64 Node-runtime mismatch still blocks real `union-search` execution on the x86_64 emulator

### Validation Snapshot

- `node --check builtin-skills/union-search/scripts/lib/request-client.cjs` passed
- `node --check builtin-skills/union-search/scripts/lib/union-search.cjs` passed
- local header inspection against `https://httpbingo.org/headers` confirmed desktop Chromium Windows request headers for both document-style and JSON-style requests
- local cookie/redirect inspection against `https://httpbingo.org/cookies/set?...` confirmed cookie persistence within the request client
- `node builtin-skills/union-search/scripts/run-union-search.cjs visit_url.internal --url https://example.com` passed
- `npm run lint` passed
- `npm run build` passed
- `node scripts/cap-sync-android.mjs` passed

### Open Follow-Up

- if desktop-browser-like headers alone are still not enough for a target site, the next escalation path is a true browser-rendered execution mode rather than adding more static header spoofing
- if emulator-side verification of real `union-search` execution is needed for this request-layer change, resolve the x86_64 vs AArch64 runtime mismatch first

## 2026-04-28 17:20 +08:00

### Scope

- rebuild the signed Android release APK after the latest `union-search` networking changes
- upload the refreshed artifact to the user's remote File Browser cloud drive root

### Current High-Signal State

- `npm run android:build:release` succeeded from the current worktree after the desktop-Chromium request-header refactor
- the uploaded remote APK filename is `ChatroomAI-v1.3.0-android-release-20260428-172035.apk`
- the remote root directory now contains both the earlier same-day release upload and this newer rebuild

### Validation Snapshot

- local release build command:
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:build:release`
- local copied artifact:
  - `ChatroomAI-v1.3.0-android-release-20260428-172035.apk`
- remote upload path:
  - `/ChatroomAI-v1.3.0-android-release-20260428-172035.apk`
- remote `list /` and `stat` both confirmed the file exists with size `210719635` bytes

### Open Follow-Up

- if the user wants older same-day APKs cleaned up from the cloud root, do that explicitly; current uploads intentionally avoid overwriting prior artifacts

## 2026-04-28 18:35 +08:00

### Scope

- fix `visit_url` for Zhihu question URLs that currently return a raw `403`
- keep the result honest and structured instead of pretending the challenge page is正文
- sync the updated built-in skill assets into the Android project

### Current High-Signal State

- `visit_url https://www.zhihu.com/question/54172602` is now handled by a site-specific blocked-page fallback
- when Zhihu returns the `zse-ck` challenge page, the skill now emits a Markdown payload explaining that the page is access-limited, including the HTTP status, question ID, and challenge script URL when available
- this avoids hard skill failure while preserving truthful behavior about what was and was not actually fetched
- Android assets were re-synced after the change with `node scripts/cap-sync-android.mjs`

### Validation Snapshot

- `node --check builtin-skills/union-search/scripts/lib/union-search.cjs` passed
- `node builtin-skills/union-search/scripts/run-union-search.cjs visit_url.internal --url https://www.zhihu.com/question/54172602` now returns a structured Markdown result instead of `Request failed: 403 ...`
- `npm run lint` passed
- `npm run build` passed
- `node scripts/cap-sync-android.mjs` passed

### Open Follow-Up

- if the product goal changes from graceful degradation to true Zhihu正文 extraction, the next step is not more static headers but a browser-grade authenticated/session-aware strategy

## 2026-04-28 20:24 +08:00

### Scope

- implement a browser-backed `visit_url` path for native app builds using a hidden WebView instead of Node-based direct fetching
- make browser mode the default native path for `union-search` `visit_url` / `fetch_url`, while preserving direct HTML as an explicit opt-in
- rebuild and resync Android artifacts after the new native bridge landed

### Current High-Signal State

- `src/services/skills/browser-visit.ts` now parses `visit_url` / `fetch_url` arguments, calls the native browser extractor, and renders stdout in markdown/json/text forms compatible with the existing skill contract
- `src/services/skills/run-executor.ts` now intercepts native-app `union-search` `visit_url` / `fetch_url` runs before the Node runtime path
- `SkillRuntimePlugin.java` now exposes `extractWebPage(...)` and loads `android/app/src/main/assets/browser-page-extractor.js` into a hidden WebView
- config/docs now mark browser mode as the native-app default for `visit_url`

### Validation Snapshot

- `npm run build` passed after the new browser-visit TypeScript path
- Android `assembleDebug` passed after the new native bridge and extractor asset were added
- `node scripts/cap-sync-android.mjs` passed after the prompt/config updates
- emulator install with `adb install --no-streaming -r` succeeded after streamed-install signature issues
- direct emulator-side browser extraction verification remains incomplete:
  - an earlier visible-target check showed `SkillRuntime.extractWebPage(...)` timing out before the latest simplification
  - after the simplification, the app rebuilt and reinstalled successfully, but the DevTools target state became unstable and no clean final success payload was captured in this handoff

### Open Follow-Up

- rerun a clean emulator or phone-side browser-mode extraction check now that the simplified `onPageFinished -> delayed extract` flow is in place
- if hidden WebView targets keep lingering in DevTools after extraction, audit the native cleanup path for a retained WebView lifecycle leak

## 2026-04-28 20:26 +08:00

### Scope

- move the “search only finds candidate links; fetch the chosen URL for正文” guidance out of the default system prompt and keep it only in the `union-search` skill definition

### Current High-Signal State

- `src/services/skills/default-system-prompts.ts` no longer hardcodes the联网搜索工作流 policy
- the guidance still exists in `builtin-skills/union-search/SKILL.md` frontmatter/body, which is the intended ownership boundary for that behavior

### Validation Snapshot

- `builtin-skills/union-search/SKILL.md` still contains:
  - 搜索结果只用于发现候选链接
  - 需要网页内容时，必须继续访问候选 URL
  - 需要正文时，先搜索，再对候选链接调用 `visit_url`

### Open Follow-Up

- if future skills need similarly strong workflow hints, prefer putting them in the relevant skill definition rather than the global default prompt

## 2026-04-28 12:16 +08:00

### Scope

- consolidate current ChatroomAI development state into repo-tracked handoff docs
- capture the current `run` refactor status and the latest phone-side runtime fix
- prepare a global Codex skill so future development agents on this machine must read and maintain repo-local status docs

### Current High-Signal State

- `run` is now the active execution model, with auto-session generation for new runs and explicit-session requirement for run inspection
- Android native execution is direct-process based, not `runtime-shell` based
- the recent phone repro against the active old-page conversation exposed a Node absolute-path handling bug, and that bug has been fixed in native code
- default prompt examples now use `<run>` instead of `<skill_call>` in the active default prompt set

### Validation Snapshot

- `npm run lint` passed
- `npm run build` passed
- Android debug build passed
- phone install succeeded via `adb install --no-streaming -r`
- direct phone WebView validation confirmed the fixed Node launch path reaches the real Node runtime instead of a double-prefixed broken path

### Open Follow-Up

- rerun the active phone UI conversation end-to-end after the latest fix
- decide whether `.internal` built-in helper scripts are a permanent design choice or technical debt to remove
- keep future handoffs updating this directory in the same branch / commit / PR as code changes
