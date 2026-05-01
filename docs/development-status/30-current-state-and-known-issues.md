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

As of 2026-05-01:

- the homepage-only implementation pass for the approved product-page redesign now exists in real app code:
  - the empty new-conversation homepage keeps the editorial daily-cover hero
  - the homepage header now uses a dedicated compact `动话 · 新对话` title line closer to the approved prototype instead of the old larger generic title treatment
  - homepage summary pills now use the approved shortened wording: `轮次`, `输入`, `输出`, `总计`
  - the separate homepage mode strip was removed
  - the homepage composer model trigger keeps showing the selected model id plus the current mode, while the homepage model popover keeps response-mode switching at the bottom
  - the homepage model popover styling was revalidated on-device in the open state, while non-homepage pages still keep the shared existing composer behavior
  - the homepage composer and model row are now rendered through a dedicated homepage footer slot inside the scene, rather than by globally overlaying the shared footer with large negative margins
  - the homepage bottom composer geometry now uses the prototype-aligned square/rectangular control language instead of the old shared pill geometry
  - the homepage footer vertical placement was lowered again so the second-row controls now sit much closer to the prototype’s bottom spacing and their bottom gap is visually closer to the left/right insets
  - the homepage footer spacing now uses a shared homepage gap token so the first-row gap, second-row gap, second-row side inset, and second-row bottom inset all resolve from the same base spacing value
  - after the follow-up bottom-offset correction, the previous visually oversized bottom gap is no longer the dominant mismatch in the homepage footer
  - the homepage footer is now rendered through an app-shell-level dock instead of a hero-internal absolute slot, so footer side/bottom spacing and safe-area handling are owned by one layout layer
  - the homepage daily-cover image is now elevated to a real scene-level background layer for the empty homepage state instead of remaining a large rounded card background
- local self-hosted free commercial fonts are now wired into the real app homepage styling:
  - `Noto Serif SC`
  - `Noto Sans SC`
  - `Newsreader Italic`
  - `Manrope`
  - the corresponding subset assets live under `src/assets/fonts/`
- this Windows machine’s frontend dependency environment was restored:
  - `node_modules/` had gone missing locally
  - `npm install` restored the dependency tree and updated the lockfile back into a runnable state
- Android debug validation for the homepage redesign succeeded on `emulator-5554`, but required a few local-environment recoveries:
  - the Gradle wrapper distribution had to be downloaded into `.gradle-local-v120/wrapper/dists/...` because wrapper TLS download failed from Java
  - one stale/generated `android/capacitor-cordova-android-plugins/` directory had to be removed and regenerated through `cap sync`
  - one `clean assembleDebug` run cleared an intermediate Android resource-linking failure
- current validation passed through:
  - `npm run lint`
  - `npm run build`
  - `node scripts/cap-sync-android.mjs`
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
  - repo-local emulator skill headless launch on `emulator-5554`
  - `prepare-chatroomai.ps1` debug install/start on `emulator-5554`
- homepage first-look screenshots captured after install:
  - `.tmp-emulator-homepage-firstlook-v4.png`
  - `.tmp-emulator-homepage-firstlook-v7.png`
  - `.tmp-emulator-homepage-firstlook-v10.png`
  - `.tmp-emulator-homepage-firstlook-v12.png`
- current known homepage visual state:
  - the homepage first-look is now much closer to `docs/prototypes/actichat-product-pages/new-conversation.html`
  - the homepage open-state model popover also now reads much closer to the approved prototype on `emulator-5554`
  - the previous structural mismatch where the image looked like a rounded content card instead of a real background layer has been removed
  - the previous bottom-bar mismatch where the real app still used pill geometry instead of the prototype’s square control language has been removed
  - the previous lower-footer mismatch where the second row sat too high above the safe-area bottom has now been reduced substantially
  - the footer spacing is now also structurally normalized instead of merely hand-tuned: first-row gap, second-row gap, side inset, and bottom inset now move together
  - the specific earlier issue where the bottom inset still looked obviously larger than the other footer gaps has now been corrected in the latest emulator screenshot pass
  - the footer spacing logic is now structurally simpler: the homepage footer dock owns visible side/bottom spacing, instead of splitting that responsibility between the hero scene and the outer shell
  - the remaining residual difference is now mostly minor pixel-level typography/spacing polish, the unavoidable real-app provider grouping inside the model popover, and the current white system-bar background still visible on emulator screenshots

As of 2026-04-30:

- response mode is now conversation-owned instead of global:
  - each conversation stores its selected text/skill mode in conversation preferences
  - empty conversations can still switch modes
  - the first user message locks that conversation to its current mode
  - append / regenerate / queued turn execution now reuse the conversation’s locked mode instead of a global flag
- transcript and storage layers now understand per-conversation response mode:
  - `src/services/chat-transcript/` exports response-mode normalization plus helpers for mutating/inferencing conversation mode
  - chat-storage schema version is now `3`
  - stored conversations backfill/infer response mode during load/migration when older records do not carry explicit mode metadata
- validation passed through direct Node entrypoints on this Linux machine:
  - `node node_modules/eslint/bin/eslint.js .`
  - `node node_modules/typescript/bin/tsc -b`
  - `node node_modules/vite/bin/vite.js build --configLoader native`
- Android deploy of the current response-mode change now also succeeded on the physical phone:
  - `node node_modules/@capacitor/cli/bin/capacitor sync android` passed
  - debug APK rebuild succeeded through a temporary CRLF-stripped Gradle wrapper on this Linux machine
  - `adb -s c3fec216 install --no-streaming -r android/app/build/outputs/apk/debug/app-debug.apk` succeeded
  - `adb -s c3fec216 shell am start -n com.dandwan.chatroomai/.MainActivity` succeeded
  - phone package state reports `versionName=1.5.0`, `versionCode=1500`, `lastUpdateTime=2026-04-30 20:48:52`
- this machine’s local `npm run lint` / `npm run build` wrappers were blocked by missing execute bits on `node_modules/.bin/{eslint,tsc}`
- this machine’s `vite build` also initially lacked the optional Rolldown native binding and was unblocked locally with:
  - `npm install --no-save @rolldown/binding-linux-x64-gnu`
- this machine’s tracked `android/gradlew` still carries CRLF line endings, so Linux-side Gradle execution needed a temporary `tr -d '\r'` wrapper instead of calling `./gradlew` directly

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
- debug Android build succeeded with local Gradle home `.gradle-local-v120` through `:app:assembleDebug`
- the canonical `union-search` skill source package now exists at `codex-skills/union-search/`
- `builtin-skills/union-search/` is now synced from that canonical source package instead of being hand-edited independently
- `visit_url` now uses a Defuddle-based extraction path owned by the skill itself
- `visit_url --extract browser` now works in desktop environments through local Chrome / Edge headless DOM capture without ChatroomAI / ActiChat host-specific extraction code
- TypeScript host special-casing for `union-search` webpage visits has been removed
- the old native browser extractor path and `browser-page-extractor.js` asset have been removed from the host codepath
- built-in skill materialization now uses emitted asset URLs plus a materialization signature to avoid repeatedly rewriting the large synced `union-search` bundle
- `npm run android:gradle -- assembleDebug` passed with local Gradle home `.gradle-local-v120`
- `npm run android:gradle -- assembleRelease` passed with local Gradle home `.gradle-local-v120`
- headless emulator launch plus `prepare-chatroomai.ps1` install/start succeeded on `emulator-5554`
- phone install via `adb -s c3fec216 install --no-streaming -r android\\app\\build\\outputs\\apk\\debug\\app-debug.apk` succeeded
- app start on phone `c3fec216` succeeded; if already running, Android simply brought the existing task to front
- the latest debug APK was uploaded to the user's File Browser cloud root as `/ActiChat-v1.3.0-debug-20260429-105201.apk`
- a fresh release APK from the current worktree was uploaded to the user's File Browser cloud root as `/ActiChat-v1.5.0-android-release-20260429-171520.apk`
- a newer fixed release APK from the current worktree was uploaded to the user's File Browser cloud root as `/ActiChat-v1.5.0-android-release-20260429-174609.apk`
- a signed `v1.5.0` Android release APK was built locally as `ActiChat-v1.5.0-android-release.apk`
- phone install of the uploaded fixed release APK succeeded on `c3fec216` through `adb install --no-streaming -r`
- app launch on phone `c3fec216` succeeded; Android reported that the existing task was brought to the front
- GitHub branch `release-v1.5.0` was pushed
- GitHub release `ActiChat v1.5.0` was published at `https://github.com/Dandwan/ChatroomAI/releases/tag/v1.5.0`
- WebView DevTools smoke checks on `emulator-5554` proved native absolute-path support by:
  - reading `/system/etc/hosts`
  - writing and reading back `/data/data/com.dandwan.chatroomai/files/skill-host/home/edit-smoke/location-root-test.txt`
  - listing the absolute parent directory and seeing the new file
- a local TS smoke script via temporary `npx --yes tsx` invocation verified:
  - `normalizeSkillAgentProtocolResponse(...)` parses `<edit>` and normalizes payloads back to `location`
  - `applyTextEdits(...)` enforces `expectedText` and returns preview snippets
- a strict project-level requirement now exists for `union-search`: it must remain a Codex-native, host-independent skill that can run as a complete equivalent skill outside ChatroomAI / ActiChat; see `docs/union-search-skill-requirements.md`
- a first implementation slice of the approved front-end redesign now exists in real app code:
  - daily-cover settings model and bundled cover pool are wired into app settings
  - the new-conversation empty state now uses an editorial full-bleed daily cover treatment
  - homepage summary stats now use priority-based selection (`词元消耗` / `历史会话` / `工具调用`, then backups)
  - assistant replies are now rendered in a lighter prose-first style instead of a heavy boxed card treatment
  - settings and drawer surfaces now have a first-pass editorial restyle through a dedicated CSS overlay
- Android UI validation for that redesign slice succeeded on `emulator-5554` after debug rebuild/reinstall
- builtin skill loading is now isolated per skill:
  - a builtin skill materialization failure no longer causes `listSkills()` to fail as a whole
  - failed builtin skills now come back as disabled records with a `loadError`
  - the settings UI now marks those skills as failed, shows the error in the description area, and disables their enable/config controls
- `npm run build` passed after the per-skill failure-isolation change
- `npm run android:gradle -- assembleDebug` passed after removing invalid `.gitkeep` placeholders from `android/capacitor-cordova-android-plugins/src/main/{java,res}/`
- the latest physical-phone reinstall for this failure-isolation change succeeded:
  - `adb -s c3fec216 install --no-streaming -r android\\app\\build\\outputs\\apk\\debug\\app-debug.apk`
  - app launch succeeded; Android brought the existing task to the front

## Union Search Current State

- `union-search` now satisfies the core portability direction at the skill-package level:
  - it has a canonical Codex-native source package
  - the skill itself owns webpage extraction
  - the host no longer carries `union-search`-specific browser-extraction logic
- Android verification is now partially unblocked:
  - a fresh debug build was assembled successfully
  - the resulting debug APK installed and started on `emulator-5554`
  - a full in-app `union-search` conversation smoke has still not been replayed end-to-end through the normal chat loop
- browser mode is now desktop-skill-driven rather than host-driven:
  - browser mode depends on a local Chrome / Edge executable when requested
  - built-in app defaults intentionally prefer `html` mode so the synced skill remains usable on the current packaged Node runtime path

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

- continue the front-end redesign beyond the first shipped slice:
  - refine the new-conversation hero typography and density further if needed
  - verify and polish active-chat, settings, and drawer states on-device
  - decide whether the homepage mode toggle should stay as a separate strip or be integrated more tightly into the cover surface
- if homepage visual parity with the prototype must become pixel-tight rather than “same first-look structure,” continue adjusting only:
  - lower hero/composer overlap spacing
  - homepage stat-card density
  - model-row vertical placement inside the cover
- if future product requirements add more per-conversation runtime behavior, extend conversation preferences in transcript/storage instead of reintroducing global mode flags
- investigate why repeated Android debug rebuilds after `cap sync` can intermittently hit duplicate asset merge errors under `public/builtin-skills/union-search/...`; a `clean` followed by `assembleDebug` cleared the latest occurrence

- Replay the phone UI flow end-to-end in the active old-page conversation after the latest Node-path fix, instead of relying only on direct native/WebView invocation.
- run one full in-app skill-agent conversation that naturally emits `<read location="...">` and `<edit location="...">`, so the parser/executor/native bridge path is validated as one continuous loop instead of split smoke tests
- if desired, install the latest debug APK again on the physical phone after the prompt-field split so the on-device settings UI exactly matches the latest build
- Decide whether the remaining `.internal` helper scripts should stay as an intentional compatibility layer or be simplified away in a future cleanup.
- If future prompt work touches legacy migration code, keep straight which strings are active defaults and which ones are snapshot constants used only for migration detection.
- Add or source an x86_64-compatible Node runtime if x86_64 emulator testing must execute `union-search` for real, not merely validate prompt/action selection.
- Investigate why `ChatroomAI_API_35_ARM64` failed to attach to `adb` on this machine during the latest headless and manual launch attempts.
- If future requirements demand actual Zhihu正文 extraction instead of graceful degraded output, that will require a stronger browser/session strategy than static headers alone.
- Run one fresh emulator or phone-side verification against the newly synced `union-search` built-in skill through the normal chat loop, not only through direct desktop Node entrypoints and install/start smoke.
