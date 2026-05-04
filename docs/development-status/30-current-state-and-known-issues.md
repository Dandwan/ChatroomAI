# Current State And Known Issues

## Worktree Reality

The repository is very dirty.

- There are many unrelated modified files.
- The previously accumulated root temp screenshots, XML dumps, copied APKs, historical debug captures, and generated build directories were cleaned on 2026-05-03 at the user's request.
- Large local caches still remain under `.gradle-local-v120/`, `node_modules/`, and `.local/` by intent because they are expensive or annoying to regenerate.
- `.gitignore` now covers root `/.tmp-*` captures plus timestamped local `ActiChat` / `ChatroomAI` APK copy names.
- Do not use broad cleanup or revert commands unless the user explicitly asks for that cleanup.

## Latest Managed Runtime Permission Recovery State

As of 2026-05-03:

- the phone-side `union-search` `permission denied` regression was traced to the managed Node runtime under `/data/data/com.dandwan.chatroomai/files/skill-host/runtimes/nodejs-termux-aarch64/bin/node`
- the root cause was host/runtime trust drift, not `union-search` business logic:
  - existing bundled runtimes were being treated as healthy when their manifest existed, without re-running `preparePath`
  - managed runtime launches had no final execution-time self-heal when execute bits on the installed runtime tree were lost
- the fix is host-generic, not `union-search`-specific:
  - `src/services/skills/runtime.ts` now reapplies `nativePreparePath(...)` for already-installed bundled runtimes before cached metadata is reused
  - `SkillRuntimePlugin.java` now self-heals managed runtime permissions immediately before native inspect/run launch
- validation in this handoff:
  - `adb logcat` on phone `c3fec216` previously showed `F/linker: error: unable to open file ".../nodejs-termux-aarch64/bin/node"`
  - after rebuild, release install, and relaunch on the same phone, startup logs no longer showed that linker error
  - `npm run build` passed
  - `node scripts/cap-sync-android.mjs` passed
  - `assembleDebug` passed with a temporary LF wrapper plus a temporary Google Maven mirror init script
  - `assembleRelease` passed with the same local workarounds
  - `adb -s c3fec216 install --no-streaming -r android/app/build/outputs/apk/release/app-release.apk` succeeded
  - after deleting `/data/data/com.dandwan.chatroomai/files/skill-host/builtin-skills/union-search` and relaunching, the rebuilt built-in tree came back with `scripts/union_search` and `scripts/union_search.internal` at `755`, clearing the original `permission denied` condition on the phone
- current remaining validation gap:
  - this handoff revalidated runtime recovery and app relaunch on the phone, but did not replay a full model-driven in-app `union-search` conversation end-to-end

## Latest First-Send Chat Transition State

As of 2026-05-03:

- the empty new-conversation homepage no longer shrinks the daily cover into an in-chat summary card
- the first real send now uses a dedicated `homepageSendTransition` overlay in `src/App.tsx`:
  - the cold-start cover scene is snapshotted into fixed overlay geometry
  - the overlay carries both the background image and the homepage showcase copy
  - the overlay moves upward and leaves the screen, revealing the real message flow underneath
- the transition lifecycle no longer depends on a JS timeout racing the WebView compositor:
  - the overlay now clears itself on `animationend`
  - this replaced the earlier timer-based cleanup that proved less trustworthy on Android WebView
- the first-send transition timing remains at the original baseline:
  - `HOMEPAGE_SEND_TRANSITION_DURATION_MS` is `920`
  - easing remains `linear`
- active chat no longer renders any daily-cover summary slot or summary-card component:
  - `src/components/DailyCoverSummaryCard.tsx` is removed
  - the old `showChatBanner` daily-cover setting is removed from runtime settings and settings UI
- the earlier Android-validated behavior still remains true:
  - there is no active-chat summary card
  - `.app-header` and `.homepage-footer-dock` backgrounds are transparent
- validation for this refinement was source-side only in this handoff:
  - `npm run lint`
  - `npm run build`
- current remaining validation gap:
  - this refined overlay geometry and faster easing have not yet been re-verified on Android WebView or the physical phone in this turn

## Latest Chat Composer Height State

As of 2026-05-04:

- the chat-page composer top row now uses the same `46px` control height as the lower model / tool row
- this was implemented in `src/styles/app-editorial-redesign.css` by:
  - changing `--homepage-composer-row-height` from `52px` to `46px`
  - deriving `--homepage-footer-dock-height` from the shared composer height tokens instead of leaving it as the old hardcoded `114px`
  - reducing editorial chat-input vertical padding from `14px 18px` to `12px 18px`
- the homepage chrome spacing has been returned to the original `8px` footer gap:
  - `--homepage-footer-gap` remains `8px`
  - the extra equal-spacing footer gutter work from the blur pass has been rolled back
- the derived dock-height change is back to the original baseline:
  - the footer shell once again reserves the original 8px spacing instead of the shared 10px gap token

## Latest Bottom Composer Glass State

As of 2026-05-04:

- the bottom dock shell and composer controls now use the same `14px` frosted blur treatment as the title bar:
  - message input
  - send / stop button
  - model trigger
  - image picker button
  - camera button
- the model popover now uses the same `14px` blur field treatment instead of the older flat panel variant
- validation status for this pass:
  - `npm run build`
  - `npm run lint` failed on an existing `src/App.tsx:1099` `react-hooks/set-state-in-effect` warning that is unrelated to this CSS change
- remaining validation gap:
  - this blur pass has not yet been re-verified on `emulator-5554` or the physical phone `c3fec216`

## Latest Settings Input Styling State

As of 2026-05-02:

- the dark-mode settings input regression is fixed in `src/styles/app-editorial-redesign.css`
- the previous separate light `paper-field` treatment for settings text inputs and select-like triggers has been replaced with shared dark editorial field tokens owned by `.settings-screen`
- normal settings text inputs now resolve through the same dark field language as the chat composer:
  - background `rgba(10, 12, 18, 0.88)`
  - border `rgba(244, 239, 231, 0.12)`
  - text `rgba(244, 239, 231, 0.88)`
  - radius `4px`
- the same dark field system now also covers:
  - settings popover triggers such as the theme selector
  - JSON type triggers inside the skill-config structured editor
- the larger dark card editors intentionally remain a separate variant:
  - raw JSON / prompt-style multi-line editors still use the existing `settings-chat-input-card` treatment with `14px` radius
  - this is deliberate so dense editor surfaces stay visually distinct from compact form fields instead of collapsing everything into one identical box
- device-side validation for this fix did not rely only on source inspection:
  - the debug app was rebuilt, synced, installed, and launched on `emulator-5554`
  - WebView DevTools CDP was attached to the running app page at `https://localhost/`
  - the settings UI was opened through runtime DOM clicks
  - computed styles confirmed real compact settings inputs and the settings popover trigger now use the dark field background instead of the old white field background

## Latest Phone Install State

As of 2026-05-03:

- the current debug APK at `android/app/build/outputs/apk/debug/app-debug.apk` was rebuilt and reinstalled onto the physical phone `c3fec216`
- this handoff used the repo's already-known reliable install path for that phone:
  - `adb -s c3fec216 install --no-streaming -r ...`
- the Linux host build/install path for this handoff required local environment workarounds, not source changes:
  - restore execute bits on local wrapper scripts with `chmod +x node_modules/.bin/*`
  - restore the missing local Rolldown binding with `npm install --no-save @rolldown/binding-linux-x64-gnu@1.0.0-rc.15`
  - run Gradle with `JAVA_HOME=/opt/android-studio/jbr` because the system default `java` is OpenJDK 26 and the Android build currently needed JDK 21
  - set `ANDROID_HOME=/home/dandwan/Android/Sdk` and `ANDROID_SDK_ROOT=/home/dandwan/Android/Sdk`
  - use a temporary Gradle init script that rewrote Google Maven to `https://maven.aliyun.com/repository/google` because direct JBR TLS handshakes to `dl.google.com` failed on this host
- the installed phone package currently reports:
  - `versionName=1.5.0`
  - `versionCode=1500`
  - `lastUpdateTime=2026-05-03 14:01:20`

## Latest Release Artifact State

As of 2026-05-03:

- a fresh signed `v1.5.0` Android release build was produced again from the current dirty worktree
- the local validation chain for this handoff passed through:
  - `npm run build`
  - `node scripts/cap-sync-android.mjs`
  - `assembleRelease` with repo-local Gradle cache `.gradle-local-v120`
- the release artifact currently lives at:
  - `android/app/build/outputs/apk/release/app-release.apk`
- that artifact has:
  - size `215019476` bytes
  - SHA256 `39C75D4398633CD5FA2434A06FFB6F9A8CC0805E10A0BDEC00D1C13D39A2C607`
- the same artifact was uploaded to the user's File Browser cloud root as:
  - `/ActiChat-v1.5.0-android-release-20260503-190421.apk`
- remote `stat` confirmed the uploaded file exists with size `215019476` bytes
- this Linux host still required the previously known local Android-build environment workarounds, without tracked source changes:
  - restore execute bits on local wrapper scripts with `chmod +x node_modules/.bin/*`
  - run the build with `JAVA_HOME=/opt/android-studio/jbr`
  - set `ANDROID_HOME=/home/dandwan/Android/Sdk` and `ANDROID_SDK_ROOT=/home/dandwan/Android/Sdk`
  - use a temporary LF-normalized wrapper for `android/gradlew` because the tracked file still has CRLF line endings
  - use a temporary Gradle init script that rewrote Google Maven to `https://maven.aliyun.com/repository/google` because direct JBR TLS handshakes to `dl.google.com` still failed on this host

## Branding State

- User-facing Chinese branding is now `动话`.
- English-facing project/config branding is now `ActiChat`.
- Android package name and `applicationId` intentionally remain `com.dandwan.chatroomai` for install/update continuity.

## Chat Storage Startup State

As of 2026-05-02:

- cold start no longer waits on full history hydration:
  - `src/services/chat-storage/` now persists richer `index.json` summaries plus top-level `historyStats`
  - app startup reads the summary index first and lands directly in a fresh new conversation
  - the old full-screen `正在加载聊天记录…` cold-start page is intentionally removed
- historical conversation bodies now hydrate on demand:
  - selecting a history row loads that conversation's `conversation.json` in real time
  - while that one conversation is hydrating, the UI shows a local per-conversation loading state instead of blocking the whole app shell
- homepage history metrics are now summary-driven:
  - `词元消耗 / 历史会话 / 工具调用 / 消息数量` no longer depend on cold-start transcript scans
  - those values come from persisted storage summaries and are rewritten together with chat persistence
- chat-storage schema is now `4`

## Recently Validated State

As of 2026-05-02:

- the remaining shared UI base has now been moved onto the same editorial direction instead of keeping the older pastel / glossy token layer underneath:
  - `src/index.css` now defines ActiChat editorial dark/light tokens and uses the local ActiChat font families as the default UI stack
  - `src/App.css` now provides the shared editorial baseline for notices, empty states, user cards, helper panels, message action rows, pending-image surfaces, image viewer, and shared triggers / popovers
  - `src/styles/app-overlay-panels.css` now carries matching editorial destructive-surface defaults for delete affordances and delete confirmations
- this pass explicitly validated that the redesign now carries through not only homepage / drawer / settings home, but also deeper editable settings pages and a real active-chat selection:
  - homepage cold start: `.tmp-ui-home-after-shared-pass-2.png`
  - drawer: `.tmp-ui-drawer-after-shared-pass.png`
  - settings main: `.tmp-ui-settings-main-after-shared-pass.png`
  - providers list: `.tmp-ui-providers-after-shared-pass.png`
  - provider detail after the Android readability fix: `.tmp-ui-provider-detail-after-paper-fields.png`
  - active chat after selecting a historical conversation: `.tmp-ui-active-chat-serial.png`
- a real Android WebView contrast problem was found during this pass:
  - the ultra-flat underline-only treatment for deep editable settings fields produced too-low contrast for textarea/input values on the emulator
  - those editable fields now intentionally use higher-contrast paper-field surfaces inside the dark settings shell
  - this is a deliberate product tradeoff for legibility and edit reliability, not a fallback to the older pastel system
- the latest validation for this shared editorial-base pass passed through:
  - `npm run lint`
  - `npm run build`
  - `node scripts/cap-sync-android.mjs`
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- clean assembleDebug`
  - `.codex/skills/chatroomai-android-emulator-test/scripts/launch-emulator.ps1 -Mode headless`
  - repeated `.codex/skills/chatroomai-android-emulator-test/scripts/prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI`
  - emulator screenshot inspection of the files listed above
- one Android packaging-side issue was identified and fixed during this pass:
  - `scripts/cap-sync-android.mjs` now force-mirrors `dist/` into `android/app/src/main/assets/public/` after Capacitor sync when the copied `index.html` does not match the built `dist/index.html`
  - this was needed because the earlier sync path could leave Android assets pointing at an older hashed entry bundle even after a successful web build
- the final device-side validation after fixing that sync mismatch additionally confirmed:
  - skill delete now uses the in-app editorial confirmation dialog instead of the older WebView/native `window.confirm` path:
    - `.tmp-ui-delete-dialog-after-syncfix.png`
  - the skill-config visual editor now uses the intended higher-contrast paper-field treatment:
    - `.tmp-ui-skill-config-latest.png`
  - the raw JSON section now renders through the same dark-shell / high-contrast editor system:
    - `.tmp-ui-skill-config-raw-json.png`
- current remaining fidelity / validation limitations after this pass:
  - the Android emulator still shows the previously known white system status-bar background above the WebView
  - active chat is now structurally aligned with the approved direction, but still not guaranteed to be pixel-identical to the standalone prototype in every transient assistant-flow state

- the settings surface now has a dedicated prototype-aligned editorial implementation in real app code:
  - the real settings overlay now follows `docs/prototypes/actichat-product-pages/settings-home.html` and `settings-daily-cover.html` much more closely while preserving all existing settings logic and subpage routing
  - the main settings page now opens with an editorial intro, a real daily-cover preview hero, and prototype-style summary sections for provider, daily cover, permissions, and extensions
  - provider / prompt / generation / conversation / display sections keep their original capabilities, but now read as one continuous long-form dark settings surface instead of a stack of thick control cards
  - the dedicated daily-cover page now uses the same visual language with a denser hero title line, long-form section headings, and prototype-style display-rule / bundled-pool / API sections
  - the redesign work for this pass is limited to:
    - `src/App.tsx`
    - `src/styles/app-editorial-redesign.css`
- the latest validation for this settings redesign pass passed through:
  - `npm run lint`
  - `npm run build`
  - `node scripts/cap-sync-android.mjs`
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
  - `.codex/skills/chatroomai-android-emulator-test/scripts/launch-emulator.ps1 -Mode headless -Restart`
  - `.codex/skills/chatroomai-android-emulator-test/scripts/prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI`
  - emulator screenshot inspection of:
    - `.tmp-settings-redesign-main-v3.png`
    - `.tmp-settings-redesign-daily-cover-v3.png`
- current remaining fidelity limitation for the settings pass:
  - the Android emulator still shows the previously known white system status-bar background above the WebView, so whole-screen screenshots cannot become a byte-for-byte match to the standalone prototype even though the settings content surface itself is now much closer
  - deep utility-heavy subpages such as skill-config and raw JSON editing now share the same visual system, but they remain necessarily denser than the flat marketing-style prototype because the real app still exposes fully editable controls there

- the history drawer now has a dedicated prototype-aligned editorial implementation in real app code:
  - the left drawer surface now matches `docs/prototypes/actichat-product-pages/drawer.html` much more closely without changing the exposed right-side chat page
  - the old `ISSUE 08 · TODAY'S INDEX` line is gone
  - group labels now render with drawer-only natural-day formatting:
    - `TODAY · HH:mm`
    - `YESTERDAY · HH:mm`
    - `MM/DD · HH:mm`
  - the drawer keeps real app behavior for conversation switching, group collapsing, swipe/delete mode, scroll restoration, settings launch, and new-conversation creation
  - the footer actions now use the prototype-style iconless rectangular control language instead of the older shared pill/button treatment
  - the restyle is now isolated through drawer-specific structure/classes instead of broad new global mutations to every shared `.conversation-*` surface
- the latest validation for this drawer redesign pass passed through:
  - `npm run lint`
  - `npm run build`
  - `node scripts/cap-sync-android.mjs`
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
  - `.codex/skills/chatroomai-android-emulator-test/scripts/launch-emulator.ps1 -Mode visible`
  - `.codex/skills/chatroomai-android-emulator-test/scripts/prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI`
  - emulator screenshot inspection of:
    - `.tmp-drawer-iteration0-home.png`
    - `.tmp-drawer-iteration2-open.png`
- the latest physical-phone package state after follow-up debug install on `c3fec216` is:
  - `versionName=1.5.0`
  - `versionCode=1500`
  - `lastUpdateTime=2026-05-02 04:09:38`
- current remaining fidelity limitation for the drawer pass:
  - the right-side exposed chat page was intentionally left unchanged for this task, so whole-screen screenshots cannot become a byte-for-byte match to the standalone prototype
  - the current emulator history state only exposed one visible real conversation row, so multi-row density was judged against the prototype language rather than a like-for-like data population

- the homepage history drawer regression on the empty new-conversation page is now fixed in app code:
  - homepage content now renders through a dedicated `app-shell-content` layer above the daily-cover background
  - shell-level overlays such as the history drawer no longer inherit the homepage-empty content-layer rule that had been forcing them back into normal document flow
  - the drawer once again opens as an overlay above the homepage instead of pushing the page layout sideways
  - Android emulator validation on `emulator-5554` confirmed the history drawer now visually overlays the homepage and that selecting a historical conversation closes the drawer and switches into that conversation
- the latest validation for this drawer fix passed through:
  - `npm run lint`
  - `npm run build`
  - `node scripts/cap-sync-android.mjs`
  - `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
  - `.codex/skills/chatroomai-android-emulator-test/scripts/launch-emulator.ps1 -Mode headless`
  - `.codex/skills/chatroomai-android-emulator-test/scripts/prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI`
  - emulator screenshot inspection for cold-start homepage, opened drawer, and drawer-driven conversation selection
- current remaining validation gap for the drawer path:
  - the current emulator state only exposed one visible history group, so multi-group auto-collapse was not directly observed on-device in this handoff
  - transparent-area tap-to-dismiss was inconclusive through raw `adb shell input tap ...` coordinates, even though conversation-item selection and drawer overlay layering both behaved correctly

As of 2026-05-02:

- the real chat page no longer treats homepage and active chat as two separate shells:
  - the same chat-page header, top stats row, composer geometry, and model popover styling now carry across both the empty new-conversation state and the active message state
  - the title line now stays in the same `动话 · <conversation>` structure instead of switching to a separate non-homepage title treatment after the first send
  - the footer now always renders through the same bottom dock wrapper instead of using a homepage-only dock in one state and a direct composer render in the other
  - the message content now flows through one shared `chat-content-frame`, so homepage copy, the active-chat cover summary, and message cards all resolve from the same horizontal inset system
- the daily-cover transition for the first real send from an empty conversation now exists in app code:
  - a `dailyCoverTransition` state machine in `src/App.tsx` snapshots the homepage background rect on first send
  - the target top summary banner is measured from the real active-chat layout instead of being hardcoded
  - the transition now runs as a same-page cover shrink into the active-chat summary-card slot instead of a hard cut from one page treatment to another
- active chat now lands on a quieter dark reading surface after the cover transition finishes:
  - a dedicated active-chat background layer now replaces the old light generic shell after the homepage cover retracts
  - user messages are now visually closer to the approved editorial active-chat direction instead of keeping the earlier pastel rounded bubble treatment
  - the always-visible `复制 / 编辑 / 重试` actions now share one flatter dark-shell action style instead of mixing old rounded utility button treatments into the redesigned chat page
- daily-cover summary rendering is now centralized through:
  - `src/components/DailyCoverSummaryCard.tsx`
  - this reduces duplicated banner markup between the steady-state active chat and the measured transition target
- current screenshot-based validation for this active-chat work was done through WebView DevTools page screenshots on `emulator-5554`, not only through blind `adb` screencaps:
  - empty homepage reference: `.tmp-devtools-home-v7.png`
  - first-send transition references: `.tmp-devtools-transition-mid-v4.png`, `.tmp-devtools-transition-end-v4.png`, `.tmp-devtools-transition-final-v4.png`
  - stable active-chat reference after the shared-dock/shared-content-frame pass: `.tmp-devtools-active-clean-v2.png`
- current residual differences versus the approved `actichat-product-pages` active-chat reference are still known:
  - the chat page is materially closer, but not yet pixel-identical
  - validation screenshots that use debug commands can still surface non-product copy such as `/debug-clear-logs`
  - assistant-flow and error states still need another polish pass if the user wants stricter screenshot-level parity rather than the current structurally aligned result

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
  - direct physical-phone reinstall of the current debug build on `c3fec216` through `adb install --no-streaming -r`
  - app launch on `c3fec216` succeeded; Android reported the intent was delivered to the already running top-most instance
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
  - the latest phone-side package state after reinstall on `c3fec216` is:
    - `versionName=1.5.0`
    - `versionCode=1500`
    - `lastUpdateTime=2026-05-02 03:31:11`

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

## 2026-05-04 14:23 +08:00

### Bottom Composer / Popover State

- the bottom composer layout is back in the original two-row geometry
- the visible frosted treatment now comes from transparent shell layers plus blurred background clones, not from real `backdrop-filter`
- the model popover now uses the same shell/overlay pattern and opens visibly on the emulator
- direct `backdrop-filter` on these bottom surfaces was tested and caused the emulator WebView render path to drop, so it is intentionally disabled in the current implementation

### Validation

- `npm run build`
- `node scripts/cap-sync-android.mjs`
- `cd android && ANDROID_HOME=/home/dandwan/Android/Sdk ANDROID_SDK_ROOT=/home/dandwan/Android/Sdk JAVA_HOME=/opt/android-studio/jbr GRADLE_USER_HOME=/home/dandwan/Projects/ChatroomAI/.gradle-local-v120 sh ./.gradlew-unix assembleDebug`
- `adb -s emulator-5554 install -r -t android/app/build/outputs/apk/debug/app-debug.apk`
- `adb -s emulator-5554 shell am start -W -n com.dandwan.chatroomai/.MainActivity`
- screenshot inspection of `/tmp/actichat-home-blur-check-late.png` and `/tmp/actichat-model-popover-check-cdp.png`

### Follow-Up

- if stronger blur is still desired, test on a physical Android device or a different WebView renderer before reintroducing `backdrop-filter`
