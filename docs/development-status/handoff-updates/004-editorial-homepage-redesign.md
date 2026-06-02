# 004 — Editorial Homepage Redesign

**Period**: 2026-05-01

> Migrated from monolithic `40-handoff-log.md`. See git history for original context.


## 2026-05-01 22:45 +08:00

### Scope

- finish the homepage bottom-composer geometry pass so the real app no longer uses pill-shaped controls where the approved prototype uses square/rectangular controls
- validate both the closed homepage first-look and the opened homepage model-popover state again after that geometry change
- explicitly check whether the visible white system-bar background on emulator screenshots was solved or still remains

### Current High-Signal State

- homepage geometry/styling refinements in this handoff were limited to:
  - `src/styles/app-editorial-redesign.css`
  - `src/App.tsx`
  - `src/index.css`
- the homepage empty state now:
  - renders the input field, send button, model bar, icon buttons, and homepage response-mode buttons in a square/rectangular control language instead of the shared pill geometry
  - keeps that homepage-only geometry scoped to the homepage empty state instead of mutating the shared composer styles for every screen
  - keeps the homepage model popover aligned with the sharper rectangular control language
- screenshot-based validation from `emulator-5554` confirms:
  - the homepage first-look now clearly uses square bottom controls
  - the homepage model-popover open state also reflects the same geometry shift
- one attempted follow-up to drive the cover background through `body.homepage-empty-active` did not remove the white system-bar background on emulator screenshots
  - that behavior therefore remains an explicit unresolved Android-host / WebView presentation issue, not a hidden regression
- commit note:
  - the resulting self-only git commit is created after these status-doc edits
  - the commit hash is intentionally not written into this same entry to avoid a follow-up amend just to self-reference the commit

### Validation Snapshot

- `npm run lint`
- `npm run build`
- `node scripts/cap-sync-android.mjs`
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
- `.codex/skills/chatroomai-android-emulator-test/scripts/prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI`
- homepage first-look screenshots after the square-geometry pass:
  - `.tmp-homepage-rect-check-v1.png`
  - `.tmp-homepage-rect-check-v2.png`
- homepage model-popover open-state screenshots after the square-geometry pass:
  - `.tmp-homepage-rect-model-open-v1.png`
  - `.tmp-homepage-rect-model-open-v2.png`

### Open Follow-Up

- if you want the homepage pushed even closer to the prototype after this geometry pass, the next homepage-only refinements should focus on:
  - hero typography and line breaks
  - top header title size and optical spacing
  - Android/system-bar background behavior on emulator and device
- once homepage parity is accepted, move on to `active-chat`, `drawer`, `settings-home`, and `settings-daily-cover` under the same component/styling system

## 2026-05-01 21:21 +08:00

### Scope

- tighten the real homepage empty-state so it matches `docs/prototypes/actichat-product-pages/new-conversation.html` more closely without turning it into a separate page scene
- shorten the homepage top summary pills to `轮次 / 输入 / 输出 / 总计`
- validate both the homepage first-look and the homepage model-popover open state on the Android emulator

### Current High-Signal State

- homepage-specific implementation was refined in:
  - `src/App.tsx`
  - `src/components/NewConversationShowcase.tsx`
  - `src/styles/app-editorial-redesign.css`
- the homepage empty state now:
  - uses a dedicated compact header title line instead of the earlier larger generic serif title treatment
  - keeps the real daily-cover scene but tightens hero type scale, byline contrast, meta spacing, stat-card density, and footer control sizing
  - shows the shortened top summary-pill wording `轮次 / 输入 / 输出 / 总计`
  - keeps real app behavior for daily-cover data, homepage stats, selected model, and conversation-owned response-mode locking
  - keeps provider grouping in the homepage model popover while preserving the homepage-only response-mode footer at the bottom
- emulator-side visual checks now confirm both:
  - the cold-start homepage first-look is close to the approved prototype
  - the opened homepage model popover remains coherent after the density/style tightening
- commit note:
  - the resulting self-only git commit is created after these status-doc edits
  - the commit hash is intentionally not written into this same entry to avoid a follow-up amend just to self-reference the commit

### Validation Snapshot

- `npm run lint`
- `npm run build`
- `node scripts/cap-sync-android.mjs`
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`
- `.codex/skills/chatroomai-android-emulator-test/scripts/launch-emulator.ps1 -Mode headless`
- `.codex/skills/chatroomai-android-emulator-test/scripts/prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI`
- `adb -s emulator-5554 shell screencap -p ...` plus local screenshot inspection for the homepage first-look
- `adb -s emulator-5554 shell input tap 410 2185` plus `adb -s emulator-5554 shell screencap -p ...` for homepage model-popover open-state inspection

### Open Follow-Up

- if stricter pixel-level parity is still desired on the homepage, continue refining only:
  - the hero title line breaks and type scale
  - the header title line size and spacing
  - the homepage model-popover provider-group presentation
- once homepage parity is accepted, move to `active-chat`, `drawer`, `settings-home`, and `settings-daily-cover` under the same component/styling system

## 2026-05-01 08:28 +08:00

### Scope

- land the approved homepage-only redesign into the real app without changing active-chat, drawer, or settings flows
- move homepage response-mode switching into the bottom of the model popover and remove the old standalone homepage mode strip
- restore the local dependency/build environment and validate the homepage first-look on the Android emulator

### Current High-Signal State

- homepage-related app code now reflects the prototype structure more closely:
  - `src/components/NewConversationShowcase.tsx`
  - `src/styles/app-editorial-redesign.css`
  - `src/App.tsx`
  - `src/index.css`
  - `src/assets/fonts/*`
- the homepage empty state now:
  - shows `动话 · 新对话` in the header
  - keeps the editorial cover hero, byline, and 3 homepage stats
  - removes the separate homepage mode strip
  - renders the model trigger as `当前模型 · 技能模式/文本模式`
  - places homepage response-mode switching at the bottom of the model popover only for the empty homepage state
  - keeps non-homepage composer behavior on other pages unchanged
- local free commercial font subsets are now self-hosted in the real app for homepage styling:
  - `Noto Serif SC`
  - `Noto Sans SC`
  - `Newsreader Italic`
  - `Manrope`
- the Windows workspace environment also needed repair during this handoff:
  - `node_modules/` had disappeared and was restored with `npm install`
  - the Gradle wrapper distribution had to be downloaded manually into `.gradle-local-v120/wrapper/dists/gradle-8.14.3-all/...`
  - a stale/generated `android/capacitor-cordova-android-plugins/` directory had to be removed and regenerated
  - Android debug assembly recovered after a `clean assembleDebug`

### Validation Snapshot

- `npm install`
- `npm run lint`
- `npm run build`
- `node scripts/cap-sync-android.mjs`
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- clean assembleDebug`
- repo-local emulator skill launch:
  - `.codex/skills/chatroomai-android-emulator-test/scripts/launch-emulator.ps1 -Mode headless`
- emulator install/start:
  - `.codex/skills/chatroomai-android-emulator-test/scripts/prepare-chatroomai.ps1 -ProjectRoot C:\\Users\\Dandwan\\projects\\ChatroomAI`
- homepage first-look screenshots captured from `emulator-5554`:
  - `.tmp-emulator-homepage-firstlook-v1.png`
  - `.tmp-emulator-homepage-firstlook-v4.png`
  - `.tmp-emulator-homepage-firstlook-v7.png`
  - `.tmp-emulator-homepage-firstlook-v10.png`
- later in the same handoff, the homepage layout was tightened again so the composer no longer relies on a large global negative-margin overlay:
  - the homepage composer is now injected into `NewConversationShowcase` through a footer slot
  - the cover content reserves an explicit footer safe area
  - the homepage first-look now keeps both the input row and the model row visible on the emulator first screen
- the final structural correction in this handoff moved the homepage image out of the rounded hero card model:
  - a scene-level `homepage-empty-background` layer now lives at the app-shell level for the empty homepage state
  - `NewConversationShowcase` no longer owns the actual background image bitmap
  - the latest first-look proof for that change is `.tmp-emulator-homepage-firstlook-v12.png`

### Open Follow-Up

- if the user wants stricter pixel-level parity with the prototype, continue refining only the homepage:
  - homepage stat-card density
  - exact type-size/leading parity in the hero block
  - minor lower-cover spacing polish
- once homepage visual parity is accepted, only then extend the same visual system to active-chat, drawer, and settings
- if future Android rebuilds on this machine fail again before task execution begins, first check:
  - whether `node_modules/` disappeared again
  - whether `.gradle-local-v120/wrapper/dists/gradle-8.14.3-all/...` still contains the full zip
  - whether `android/capacitor-cordova-android-plugins/` needs regeneration through `cap sync`
