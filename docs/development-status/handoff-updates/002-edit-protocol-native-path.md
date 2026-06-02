# 002 — Edit Protocol Native Path

**Period**: 2026-04-29

> Migrated from monolithic `40-handoff-log.md`. See git history for original context.


## 2026-04-29 23:28 +08:00

### Scope

- install the newest debug APK containing the per-skill failure-isolation change onto the physical phone
- record the phone-side validation after the device reappeared in `adb`

### Current High-Signal State

- target physical device:
  - `c3fec216`
- installed artifact:
  - `android/app/build/outputs/apk/debug/app-debug.apk`
- the install succeeded with the repo’s known-good non-streaming path
- app launch succeeded; Android reported that the existing task was brought to the front

### Validation Snapshot

- `C:\Users\Dandwan\scoop\apps\android-clt\14742923\platform-tools\adb.exe devices -l`
- `npm run build`
- `node scripts/cap-sync-android.mjs`
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
- `C:\Users\Dandwan\scoop\apps\android-clt\14742923\platform-tools\adb.exe -s c3fec216 install --no-streaming -r C:\Users\Dandwan\projects\ChatroomAI\android\app\build\outputs\apk\debug\app-debug.apk`
- `C:\Users\Dandwan\scoop\apps\android-clt\14742923\platform-tools\adb.exe -s c3fec216 shell am start -n com.dandwan.chatroomai/.MainActivity`

### Open Follow-Up

- validate on the physical phone that one broken skill now only disables itself instead of wiping the whole skill list:
  - `device-info` should still load
  - the broken skill should show its own error message and disabled controls

## 2026-04-29 22:55 +08:00

### Scope

- isolate builtin skill load failures so one broken skill does not hide the rest of the skill catalog
- surface per-skill load errors in the settings UI instead of failing the whole skill list
- restore stable Android debug builds after the latest packaging changes

### Current High-Signal State

- `src/services/skills/host.ts` now catches builtin materialization failures per skill, records the error by skill id, and still returns the rest of the skill catalog
- `SkillRecord` now carries `loadError`
- the settings skill list in `src/App.tsx` now:
  - shows a `加载失败` badge for failed skills
  - renders the specific error under the description
  - disables the enable toggle and config button for the failed skill
- `src/styles/app-overlay-panels.css` now includes disabled/error styling for skill cards and toggle rows
- the invalid placeholder files
  - `android/capacitor-cordova-android-plugins/src/main/res/.gitkeep`
  - `android/capacitor-cordova-android-plugins/src/main/java/.gitkeep`
  were removed so Android debug builds can complete reliably again

### Validation Snapshot

- `npm run lint` passed
- `npm run build` passed
- `node scripts/cap-sync-android.mjs` passed
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug` passed
- the current debug artifact exists at:
  - `android/app/build/outputs/apk/debug/app-debug.apk`
- physical-phone reinstall for this exact change set did not complete in this handoff because:
  - `adb devices -l` no longer showed `c3fec216`

### Open Follow-Up

- reconnect phone `c3fec216` and install the freshly built debug APK to validate the per-skill failure-isolation behavior on the physical device
- after reinstall, verify the expected user-visible behavior:
  - `device-info` still appears normally
  - the broken skill shows its own error only
  - failed skill toggle/config controls are disabled

## 2026-04-29 22:27 +08:00

### Scope

- install the latest fixed release APK onto the connected physical phone
- record the concrete device/install validation in repo-tracked status docs

### Current High-Signal State

- target physical device:
  - `c3fec216`
- installed artifact:
  - `C:\Users\Dandwan\projects\ChatroomAI\ActiChat-v1.5.0-android-release-20260429-174609.apk`
- install succeeded with the repo's known-good non-streaming path
- app launch succeeded; Android brought the existing `com.dandwan.chatroomai` task to the front

### Validation Snapshot

- `C:\Users\Dandwan\scoop\apps\android-clt\14742923\platform-tools\adb.exe devices -l`
- `C:\Users\Dandwan\scoop\apps\android-clt\14742923\platform-tools\adb.exe -s c3fec216 install --no-streaming -r C:\Users\Dandwan\projects\ChatroomAI\ActiChat-v1.5.0-android-release-20260429-174609.apk`
- `C:\Users\Dandwan\scoop\apps\android-clt\14742923\platform-tools\adb.exe -s c3fec216 shell am start -n com.dandwan.chatroomai/.MainActivity`

### Open Follow-Up

- if the user wants the same fixed release package installed onto additional physical devices, repeat the same non-streaming install path per serial instead of relying on plain streamed installs

## 2026-04-29 21:49 +08:00

### Scope

- begin landing the approved front-end redesign into the real app codebase
- add a reusable daily-cover system, homepage highlight selection logic, and first-pass UI restyles
- validate the changes through web builds plus Android emulator install/start and screenshot checks

### Current High-Signal State

- new reusable front-end modules added:
  - `src/services/daily-cover.ts`
  - `src/services/homepage-highlights.ts`
  - `src/components/NewConversationShowcase.tsx`
  - `src/styles/app-editorial-redesign.css`
- `App.tsx` now:
  - persists nested `dailyCover` settings
  - resolves bundled / API-backed daily covers with fallback
  - computes homepage highlight stats with priority ordering
  - renders the new editorial empty-state cover component
  - exposes a new settings view for daily-cover configuration
  - shows a daily-cover summary banner in active chat when enabled
- the first-pass restyle also lightens assistant message presentation and restyles drawer/settings surfaces without removing existing features

### Validation Snapshot

- `npm run lint` passed
- `npm run build` passed multiple times after the redesign slice landed
- `node scripts/cap-sync-android.mjs` passed
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug` passed
- `launch-emulator.ps1 -Mode headless` succeeded
- `attach-running-emulator.ps1 -Port 5554` succeeded
- `prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI` installed and started the debug app on `emulator-5554`
- emulator screenshots confirmed:
  - the new-conversation daily-cover hero renders in the real app
  - homepage stats now appear on-device after the mobile-density adjustments

### Open Follow-Up

- continue polishing the remaining app states under the same redesign system, especially active-chat reading flow and settings depth pages
- decide whether the empty-state mode toggle should stay visually separate or be integrated more tightly into the homepage composition
- investigate the intermittent duplicate-asset Android merge failure after repeated sync/build cycles involving `public/builtin-skills/union-search/...`; `clean` resolved the latest repro but the root cause still needs confirmation

## 2026-04-29 17:43 +08:00

### Scope

- fix the page-prototype image-loading bug outside the new-conversation page
- refine the new-conversation homepage prototype typography and summary stats based on user feedback
- keep the redesign work prototype-only without touching production `src/` code

### Current High-Signal State

- prototype bug fixed in:
  - `docs/prototypes/actichat-product-pages/script.js`
- missing prototype script include fixed in:
  - `docs/prototypes/actichat-product-pages/settings-home.html`
- homepage prototype refined in:
  - `docs/prototypes/actichat-product-pages/new-conversation.html`
  - `docs/prototypes/actichat-product-pages/styles.css`
- the new-conversation page now:
  - uses a title rhythm closer to the approved editorial reference
  - reintroduces key legacy summary data in a more restrained form
  - explicitly states that the redesign inherits old-version functionality instead of dropping it
- active chat, settings home, and daily-cover settings now correctly show their injected cover imagery
- no production app files under `src/` were changed in this handoff

### Validation Snapshot

- Microsoft Edge headless re-render succeeded for:
  - `new-conversation.html`
  - `active-chat.html`
  - `settings-home.html`
- verification screenshots produced:
  - `.tmp-page-new-conversation-v2.png`
  - `.tmp-page-active-chat-fixed.png`
  - `.tmp-page-settings-home-fixed.png`

### Open Follow-Up

- confirm whether the revised mixed-language homepage title is the right direction, or whether the user wants a fully Chinese title with the same editorial pacing
- decide whether the homepage summary stats should stay at three items, or be reduced further to only one or two highest-value metrics
- if approved, continue refining the remaining pages under the same “inherits all old functionality” constraint

## 2026-04-29 17:17 +08:00

### Scope

- build a fresh release APK from the current worktree
- upload that release package to the user's File Browser server root

### Current High-Signal State

- local source artifact:
  - `android/app/build/outputs/apk/release/app-release.apk`
- copied local upload artifact:
  - `ActiChat-v1.5.0-android-release-20260429-171520.apk`
- remote destination:
  - `/ActiChat-v1.5.0-android-release-20260429-171520.apk`
- remote root listing and remote stat both confirm the uploaded file exists with size `210734086` bytes

### Validation Snapshot

- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleRelease`
- `python ...filebrowser_ops.py upload C:\\Users\\Dandwan\\projects\\ChatroomAI\\ActiChat-v1.5.0-android-release-20260429-171520.apk /ActiChat-v1.5.0-android-release-20260429-171520.apk`
- `python ...filebrowser_ops.py list / --json`
- `python ...filebrowser_ops.py stat /ActiChat-v1.5.0-android-release-20260429-171520.apk`

### Open Follow-Up

- if you also want the latest debug APK re-uploaded alongside this release build, upload it under a separate timestamped filename instead of overwriting older debug artifacts

## 2026-04-29 17:06 +08:00

### Scope

- expand the front-end product demo into a page-by-page prototype set for targeted design review
- keep the approved editorial direction while exposing separate real-product surfaces
- add a prototype index plus standalone pages for the main app states without touching `src/`

### Current High-Signal State

- new prototype set added under:
  - `docs/prototypes/actichat-product-pages/`
- the page set currently includes:
  - `index.html`
  - `new-conversation.html`
  - `active-chat.html`
  - `drawer.html`
  - `settings-home.html`
  - `settings-daily-cover.html`
  - shared `styles.css`
  - shared `script.js`
- these pages now let the user review the redesign as separate product surfaces instead of one combined overview
- no production app files under `src/` were changed in this handoff

### Validation Snapshot

- Microsoft Edge headless renders succeeded for the page set
- verification screenshots produced:
  - `.tmp-pages-index.png`
  - `.tmp-page-new-conversation.png`
  - `.tmp-page-active-chat.png`
  - `.tmp-page-settings-home.png`
  - `.tmp-page-daily-cover-settings.png`

### Open Follow-Up

- decide which of the five surfaces should be refined next at high fidelity:
  - new conversation
  - active chat
  - drawer
  - settings home
  - daily cover settings
- decide whether follow-up prototypes should go deeper into provider / model / skill-config subpages, or focus first on polishing the main five surfaces
- if this page set is approved, the next non-code step should be producing tighter v2 page variants before implementation planning

## 2026-04-29 16:55 +08:00

### Scope

- rebuild `union-search` around a canonical Codex-native skill source package
- make `visit_url` use Defuddle as the owned extraction core
- remove the old host-coupled `union-search` browser extraction path and clean up the related host assets

### Current High-Signal State

- canonical skill source package now exists at:
  - `codex-skills/union-search`
- built-in app copy is now synced from that canonical source package through:
  - `scripts/sync-union-search-skill.mjs`
- `visit_url` now works through the skill itself:
  - direct mode: request-client HTML fetch -> Defuddle extraction
  - browser mode: local Chrome / Edge `--dump-dom` -> Defuddle extraction
- the host no longer special-cases `union-search` webpage visits:
  - `src/services/skills/browser-visit.ts` was removed
  - `src/services/skills/run-executor.ts` no longer intercepts `union-search` `visit_url` / `fetch_url`
  - `src/services/skills/native-runtime.ts` no longer exposes `extractWebPage(...)`
  - `android/app/src/main/assets/browser-page-extractor.js` was removed
  - `SkillRuntimePlugin.java` no longer carries the old browser extraction implementation
- built-in skill materialization was upgraded so the large synced `union-search` bundle is no longer inlined as raw strings into the web bundle:
  - `src/services/skills/host.ts` now keeps only metadata files inline
  - the rest of the built-in files are imported as emitted asset URLs and fetched during materialization
  - a builtin signature file now skips repeated rewrites when the materialized snapshot is unchanged

### Validation Snapshot

- `python ...quick_validate.py C:/Users/Dandwan/projects/ChatroomAI/codex-skills/union-search` passed
- direct `visit_url` smoke:
  - `node codex-skills/union-search/scripts/run-union-search.cjs visit_url.internal --url https://example.com`
- browser-mode `visit_url` smoke:
  - `node codex-skills/union-search/scripts/run-union-search.cjs visit_url.internal --url https://example.com --extract browser`
- search smoke:
  - `node codex-skills/union-search/scripts/run-union-search.cjs web_search.internal --query "Example Domain" --site example.com --limit 3 --markdown`
  - `node codex-skills/union-search/scripts/run-union-search.cjs union_search.internal --query "OpenAI agent runtime" --group preferred --limit 2 --deduplicate --markdown`
- `npm run lint` passed
- `npm run build` passed
- `node scripts/cap-sync-android.mjs` passed
- Android debug build and emulator install/start smoke passed through:
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
  - `launch-emulator.ps1 -Mode headless`
  - `prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI`

### Open Follow-Up

- run one fresh in-app `union-search` smoke through the normal chat loop instead of relying only on direct Node entrypoint checks plus install/start smoke
- consider whether the remaining `.internal` wrappers should stay as a compatibility layer or be simplified in a later cleanup now that the canonical skill source exists

## 2026-04-29 16:45 +08:00

### Scope

- move from style exploration to a product-mapped front-end demo for the real ActiChat app
- keep the corrected editorial direction, but apply it to the actual mobile chat shell, drawer, and settings structure
- add a standalone prototype that demonstrates empty state, chat state, drawer, and settings without touching production code

### Current High-Signal State

- new independent product-mapped prototype added:
  - `docs/prototypes/actichat-product-demo-v1.html`
- the new prototype explicitly maps the approved editorial language onto the real product surfaces:
  - new conversation empty state
  - active chat state
  - conversation drawer
  - settings page with daily-cover configuration
- the prototype also includes a control dock for switching between those app states locally in the browser
- no production app files under `src/` were changed in this handoff

### Validation Snapshot

- Microsoft Edge headless render succeeded for:
  - `file:///C:/Users/Dandwan/projects/ChatroomAI/docs/prototypes/actichat-product-demo-v1.html`
- product demo screenshot produced:
  - `.tmp-actichat-product-demo-v1.png`

### Open Follow-Up

- decide whether the real-product redesign should preserve the current summary token pills on the empty state, or reduce them further to keep the cover cleaner
- decide whether the final production settings page should remain fully in-app and dark, or borrow more of the lighter editorial-sheet treatment shown outside the phone frame in the prototype
- if this direction is approved, the next best non-code step is to produce one higher-fidelity prototype for each of the four app states separately before implementation

## 2026-04-29 16:22 +08:00

### Scope

- replace the previous redesign visual reference with the user-corrected `demo2-with-skill.html`
- derive a new editorial / photography-book direction from that corrected reference
- add a second standalone redesign prototype without touching production `src/` code

### Current High-Signal State

- corrected local reference used for this handoff:
  - `C:\Users\Dandwan\Downloads\garden-skills\demo\web-design-demo\demo2-with-skill.html`
- new independent prototype added:
  - `docs/prototypes/actichat-front-redesign-v2-editorial.html`
- the new prototype direction is now:
  - full-viewport daily landscape hero
  - restrained editorial typography and fixed masthead
  - bundled landscape pool plus optional daily-image API configuration
  - settings and schema shown as magazine-style follow-up sections rather than dashboard cards
- no production app files under `src/` were changed in this handoff

### Validation Snapshot

- local reference screenshot produced:
  - `.tmp-demo2-with-skill-reference.png`
- local prototype screenshot produced:
  - `.tmp-front-redesign-v2-editorial-final.png`
- Microsoft Edge headless render succeeded for:
  - `file:///C:/Users/Dandwan/projects/ChatroomAI/docs/prototypes/actichat-front-redesign-v2-editorial.html`

### Open Follow-Up

- decide whether the final product should keep the current full-screen hero on desktop only, or also preserve a shortened hero treatment on mobile
- decide whether the settings surface should remain editorial and quiet, or become slightly more app-like once moved into the real product shell
- if this direction is approved, the next step should be a concrete IA / component mapping from this prototype into the existing `App.tsx` responsibilities

## 2026-04-29 15:56 +08:00

### Scope

- refine the front-end redesign requirements without touching the current `src/` application code
- research a free commercial-use landscape image source plus daily-image API direction
- add a standalone desktop-viewable HTML prototype under `docs/prototypes/`

### Current High-Signal State

- new independent prototype added:
  - `docs/prototypes/actichat-front-redesign-v0.html`
- local prototype landscape assets added:
  - `docs/prototypes/assets/landscapes/alpine-lake.jpg`
  - `docs/prototypes/assets/landscapes/mirror-mountain.jpg`
  - `docs/prototypes/assets/landscapes/crater-lake.jpg`
  - `docs/prototypes/assets/landscapes/autumn-ridge.jpg`
- prototype direction now centers on:
  - a daily-rotating landscape cover on the new-conversation surface
  - a bundled default landscape pool with custom daily-image API as an optional override
  - more deliberate point/line editorial detailing instead of the current stacked cute/glass refinement passes
- no production app files under `src/` were changed in this handoff

### Validation Snapshot

- local asset downloads succeeded for the four prototype landscape images
- Microsoft Edge headless render succeeded for:
  - `file:///C:/Users/Dandwan/projects/ChatroomAI/docs/prototypes/actichat-front-redesign-v0.html`
- render screenshot produced:
  - `.tmp-front-redesign-v0.png`

### Open Follow-Up

- confirm whether the desired art direction should stay in the current editorial / serene direction or become warmer, darker, or more minimal
- decide the exact scope of the future settings model:
  - bundled default pool only plus optional custom API
  - or first-class presets for providers such as Pexels / Pixabay / Unsplash-compatible endpoints
- if the prototype direction is approved, the next step should be a code-free IA / component blueprint before touching `src/App.tsx`

## 2026-04-29 15:50 +08:00

### Scope

- document the enforced portability requirement for `union-search`
- write down the target architecture needed for `union-search` to run as a complete equivalent skill in Codex
- make the new requirement discoverable from project-level docs

### Current High-Signal State

- added a dedicated project document:
  - `docs/union-search-skill-requirements.md`
- top-level project docs now point at that requirement:
  - `README.md`
- development-status docs now treat the requirement as binding:
  - `docs/development-status/10-project-overview.md`
  - `docs/development-status/30-current-state-and-known-issues.md`
- the documented requirement is explicit that:
  - `union-search` must evolve into a Codex-native, host-independent skill
  - the current built-in browser-mode `visit_url` path is still host-coupled and therefore does not yet satisfy that standard

### Validation Snapshot

- reviewed current `union-search` entrypoints and host coupling points in:
  - `builtin-skills/union-search/scripts/*`
  - `src/services/skills/run-executor.ts`
  - `src/services/skills/browser-visit.ts`
  - `src/services/skills/native-runtime.ts`
  - `android/app/src/main/assets/browser-page-extractor.js`
- verified the new project documentation content through local `git diff`

### Open Follow-Up

- implement the Codex-native `union-search` skill as the canonical source package instead of continuing to treat the ChatroomAI built-in bundle as the source of truth
- migrate browser-mode page access into the skill itself and retire the host-owned extraction path as a required dependency

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
