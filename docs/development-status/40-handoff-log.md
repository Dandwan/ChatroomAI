# Handoff Log

## 2026-04-28 21:46 +08:00

### Scope

- prepare the next signed Android/GitHub release on top of `origin/main`
- fold in the latest browser-visit / `run` / `union-search` changes together with the `ActiChat` / `动话` branding update
- produce and verify a signed `v1.4.0` APK plus repo-tracked release notes

### Current High-Signal State

- a clean release worktree was created from `origin/main` to avoid pushing the original dirty local workspace and its temp artifacts
- the release worktree now includes the latest native browser extraction path, `union-search` updates, `runtime-shell` removal, and `ActiChat` / `动话` branding changes
- package/app versions were moved to `1.4.0` / `1400`
- the final signed release artifact was copied as `ActiChat-v1.4.0-android-release.apk`
- repo release notes were added at `docs/releases/v1.4.0.md`
- GitHub release `v1.4.0` is now published at `https://github.com/Dandwan/ChatroomAI/releases/tag/v1.4.0`

### Validation Snapshot

- `npm run lint` passed
- `npm run build` passed
- `node scripts/cap-sync-android.mjs` passed
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; node scripts/run-android-gradle.mjs assembleRelease` passed
- `apksigner verify --print-certs ActiChat-v1.4.0-android-release.apk` passed
- `Get-FileHash -Algorithm SHA256 ActiChat-v1.4.0-android-release.apk` produced:
  - `1BC9F639687862A3098D1342624CC6683F5A5A2557D8FD7BCFF4E08CED2B5A92`
- static APK inspection confirmed:
  - `assets/public/runtime-packages/nodejs-termux-aarch64.zip`
  - `assets/public/runtime-packages/python-termux-aarch64-scientific.zip`
  - `assets/browser-page-extractor.js`
  - `assets/public/index.html`

### Open Follow-Up

- if future branding work also needs repo-name, Java-package, or asset-filename migration away from `ChatroomAI`, treat that as a separate compatibility-sensitive change

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
