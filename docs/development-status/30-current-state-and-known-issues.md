# Current State And Known Issues

## Worktree Reality

The repository is very dirty.

- There are many unrelated modified files.
- There are many untracked temp screenshots, XML dumps, APKs, and investigation artifacts.
- Do not use broad cleanup or revert commands unless the user explicitly asks for that cleanup.

## Branding State

- User-facing Chinese branding is now `动话`.
- English-facing project/config branding is now `ActiChat`.
- Android package name and `applicationId` intentionally remain `com.dandwan.chatroomai` for install/update continuity.

## Recently Validated State

As of 2026-04-28:

- `npm run lint` passed
- `npm run build` passed
- `node scripts/cap-sync-android.mjs` passed
- debug Android build succeeded with local Gradle home `.gradle-local-v120`
- emulator install succeeded
- phone install succeeded, but MIUI was flaky with streamed installs
- direct `visit_url` / `fetch_url` validation against `https://example.com` passed
- direct `visit_url` validation against a temporary `http://localhost` test page passed, including Markdown body output plus heading/link/image indexes
- emulator launch via the repo-local emulator skill passed in headless mode
- `prepare-chatroomai.ps1` installed and started the debug app on `emulator-5554`
- a real in-app conversation on `emulator-5554` proved that the active prompt and skills catalog can drive the model into `web_search` followed by `visit_url`
- that same x86_64 emulator run failed at execution time because the bundled Node runtime is AArch64-only, so `union-search` could not start on x86_64 Android emulation
- a fresh signed release APK build succeeded from the current worktree on 2026-04-28 and was uploaded to the user's File Browser cloud drive root as `ChatroomAI-v1.3.0-android-release-20260428-141702.apk`
- the `union-search` request layer now emits desktop Chromium Windows headers by default and passed local header verification plus cookie/redirect session verification
- a newer signed release APK was rebuilt after the desktop-Chromium request-header change and uploaded to the user's File Browser cloud drive root as `ChatroomAI-v1.3.0-android-release-20260428-172035.apk`
- `visit_url https://www.zhihu.com/question/54172602` no longer fails with a raw 403; it now returns a structured access-limited Markdown result when Zhihu serves the `zse-ck` challenge page
- browser-mode `visit_url` implementation now exists in the native app codepath and the project builds/syncs successfully with it, but emulator-side stable end-to-end extraction still needs follow-up validation

As of 2026-04-29:

- `location` is now the canonical protocol field name for path-based actions; legacy incoming `root` is still accepted for compatibility
- external protocol value `root` now means system absolute-path space; internal code still maps it to legacy `absolute`
- `<edit>` now exists as a first-class host action for line-based text-file edits
- `<read>` now supports `skill`, `workspace`, `home`, and native absolute-path locations
- native `SkillRuntime` now exposes absolute-path list/stat/read/write primitives used by `location="root"` reads and edits
- default action prompts now document `<edit>` plus the `location/root` naming
- global and provider-level tag prompt settings now have a dedicated `editSystemPrompt`; run and edit rules are no longer mixed into one prompt field
- `npm run build` passed
- `npm run lint` passed
- `node scripts/cap-sync-android.mjs` passed
- debug Android build succeeded with local Gradle home `.gradle-local-v120`
- headless emulator launch plus `prepare-chatroomai.ps1` install/start succeeded on `emulator-5554`
- phone install via `adb -s c3fec216 install --no-streaming -r android\\app\\build\\outputs\\apk\\debug\\app-debug.apk` succeeded
- app start on phone `c3fec216` succeeded; if already running, Android simply brought the existing task to front
- the latest debug APK was uploaded to the user's File Browser cloud root as `/ActiChat-v1.3.0-debug-20260429-105201.apk`
- WebView DevTools smoke checks on `emulator-5554` proved native absolute-path support by:
  - reading `/system/etc/hosts`
  - writing and reading back `/data/data/com.dandwan.chatroomai/files/skill-host/home/edit-smoke/location-root-test.txt`
  - listing the absolute parent directory and seeing the new file
- a local TS smoke script via temporary `npx --yes tsx` invocation verified:
  - `normalizeSkillAgentProtocolResponse(...)` parses `<edit>` and normalizes payloads back to `location`
  - `applyTextEdits(...)` enforces `expectedText` and returns preview snippets

## Android Install Quirk

On phone `c3fec216`, plain streamed install may intermittently fail with:

- `INSTALL_PARSE_FAILED_NOT_APK`

The reliable workaround observed in this repo is:

- `adb install --no-streaming -r android\\app\\build\\outputs\\apk\\debug\\app-debug.apk`

Treat this as a device/install-path quirk unless evidence shows the APK itself is broken.

## Bugs Fixed In The Current Development Window

### 1. Run session contract mismatch

- Native layer used to reject missing `session` even when only inspecting an existing run.
- Fixed so only new launches require `session`.

### 2. `waitMs` parsing drift

- `waitMs` was observed falling back to the default instead of honoring the caller’s value.
- Fixed with a native numeric parser that accepts `Long`, `Double`, and numeric strings.

### 3. Old-page retry Node failure on phone

User-relevant repro context:

- active phone conversation: `8f7aab04-ff61-45fa-8255-5a1d928c36ee`
- user considers retrying the old page to be logically equivalent to re-running the latest work

Observed failure:

- old conversation retry reached `union-search`
- `run_error` showed a bad Node path with a double-prefixed app files directory

Root cause:

- Android native code treated `nodeExecutablePath` / `pythonExecutablePath` as app-relative even when TypeScript had already passed absolute paths

Fix:

- `SkillRuntimePlugin.java` now resolves runtime executables with `resolveFlexiblePath(...)`

Verification after the fix:

- direct WebView DevTools invocation on the phone successfully launched the `union-search` Node wrapper through:
  - `/system/bin/linker64`
  - `/data/data/com.dandwan.chatroomai/files/skill-host/runtimes/nodejs-termux-aarch64/bin/node`
  - `/data/data/com.dandwan.chatroomai/files/skill-host/builtin-skills/union-search/scripts/web_search`
- the error changed from a bad runtime path to a business-level script error (`web_search.internal requires --query`), which confirms the path bug itself is gone

## Important Context For Future Debugging

- Do not spend time arguing that the user must create a brand-new conversation for this repro. The active old-page retry context is intentional.
- The active phone conversation already contains host `run_error` evidence from before the fix; use it as regression context.
- `runtime-shell` being absent on device after a fresh sync is expected.
- `.internal` entry scripts still appearing under `union-search` / `device-info` are currently part of the tracked repo contents.

## Current Edit Behavior

- Message edit UI is driven from projected conversation messages in `src/App.tsx`, not directly from raw transcript events.
- Assistant-message edit currently rewrites the whole assistant turn into one synthetic static assistant event, which drops the prior assistant event chain plus any host-message detail for that turn.
- User-message edit supports in-place text modification or truncate-and-resend from the edited turn.
- Current user-message edit preserves existing image attachments but does not support changing attachments while editing.
- If the conversation title was not manually renamed, editing the first user turn can change the auto-derived title because title derivation is transcript-based.

## Edit / Location Protocol State

- Executable protocol tags now include `read`, `run`, `edit`, and legacy `skill_call`.
- `location` is the canonical field name for protocol-facing path roots.
- External protocol values are now:
  - `skill`
  - `workspace`
  - `home`
  - `root`
- Internal code still uses legacy `absolute` as the stored run/read/edit location for system-root compatibility, but protocol serialization now maps that back to `location="root"`.
- `<edit>` currently supports:
  - `workspace`, `home`, and system absolute-path access
  - `insert`, `delete`, `replace`
  - `beforeLine` / `afterLine`
  - optional `expectedText`
  - `createIfMissing`
  - grouped preview snippets around modified regions
- `<edit>` application is snapshot-based and atomic for one request.
- Native absolute-path access is currently implemented through the custom `SkillRuntime` plugin, not through Capacitor `Filesystem`.
- The native absolute-path smoke test is validated; a full in-app model-driven `<edit>` conversation replay was not yet run in this handoff.

## Remaining Follow-Up Work

- Replay the phone UI flow end-to-end in the active old-page conversation after the latest Node-path fix, instead of relying only on direct native/WebView invocation.
- run one full in-app skill-agent conversation that naturally emits `<read location="...">` and `<edit location="...">`, so the parser/executor/native bridge path is validated as one continuous loop instead of split smoke tests
- if desired, install the latest debug APK again on the physical phone after the prompt-field split so the on-device settings UI exactly matches the latest build
- Decide whether the remaining `.internal` helper scripts should stay as an intentional compatibility layer or be simplified away in a future cleanup.
- If future prompt work touches legacy migration code, keep straight which strings are active defaults and which ones are snapshot constants used only for migration detection.
- Add or source an x86_64-compatible Node runtime if x86_64 emulator testing must execute `union-search` for real, not merely validate prompt/action selection.
- Investigate why `ChatroomAI_API_35_ARM64` failed to attach to `adb` on this machine during the latest headless and manual launch attempts.
- If future requirements demand actual Zhihu正文 extraction instead of graceful degraded output, that will require a stronger browser/session strategy than static headers alone.
- Revisit emulator-side browser-mode extraction verification; recent hidden-WebView extraction wiring compiles, but the latest direct emulator checks did not yet produce a clean successful assertion payload.
