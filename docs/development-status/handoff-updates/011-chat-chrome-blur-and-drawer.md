# 011 — Chat Chrome Blur And Drawer

**Period**: 2026-05-09

> Migrated from monolithic `40-handoff-log.md`. See git history for original context.


## 2026-05-09 — Drawer Blur And Blur Setting

### Scope

Added backdrop-filter blur and semi-transparent background to the history drawer (conversation selection panel), and added a user-configurable blur amount setting to the settings page. The drawer panel now renders with the same frosted glass treatment as the chat header pill and composer controls.

### Changes

- `src/state/types.ts`:
  - added `chatBlurPx: number` to `AppSettings`
  - added `'chatBlurPx'` to `NumericSettingKey`
  - added `DEFAULT_CHAT_BLUR_PX = 18` constant
- `src/styles/app-editorial-redesign.css`:
  - replaced `.drawer-panel--editorial` solid background with semi-transparent (`rgba(250,247,240,0.62)` light / `rgba(7,8,13,0.62)` dark)
  - replaced `backdrop-filter: none` with `blur(var(--chat-glass-blur)) saturate(180%)` + `-webkit-` prefix
  - added `will-change: transform, backdrop-filter` and `translateZ(0)` compositor layer promotion
- `src/App.tsx`:
  - imported `DEFAULT_CHAT_BLUR_PX`, added to `DEFAULT_SETTINGS`, `NUMERIC_SETTING_DEFAULTS`, `createNumericSettingDrafts`
  - added `useEffect` syncing `--chat-glass-blur` CSS custom property on `document.documentElement` from `settings.chatBlurPx`
  - added settings loader parsing for `chatBlurPx` (clamped 0–40, integer)
  - added "模糊度（px）" numeric input control in settings "显示选项" section

### Proposal-and-confirmation gate

Completed.

### Validation

- `npx tsc -b` — zero errors
- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings
- Built CSS verified: drawer panel contains both standard `backdrop-filter` and `-webkit-backdrop-filter` with `blur(var(--chat-glass-blur)) saturate(180%)`, semi-transparent backgrounds for both light and dark modes

### Commit

- pending

### Open Items

- no fresh device/emulator screenshot pass was run to verify drawer blur on Android WebView
- existing Android WebView `backdrop-filter` rendering risk noted in prior handoff entries applies equally to the drawer

## 2026-05-09 — Chat Chrome Blur Pass

### Scope

Added visible backdrop-filter blur to top and bottom chat chrome controls. The header pill, summary bar chips, and all bottom composer controls (input, send button, model trigger, icon buttons) now use `backdrop-filter: blur(18px) saturate(180%)` with reduced background opacity so the blur is visible. Previously the bottom controls had no blur at all and the top controls used overly opaque backgrounds that made the blur imperceptible.

### Root cause of invisible blur

Two issues:
1. Top controls (header pill, summary chips) had `backdrop-filter` applied but with backgrounds at 84% opacity — only 16% transparency allowed the blur to show through, and the background colors closely matched the page background, making the 12px blur invisible even with content behind the element.
2. Bottom controls had `backdrop-filter: none` on their shell layers, and the individual controls used opaque solid backgrounds without any blur.

### Changes

All in `src/styles/app-editorial-redesign.css`:
- Reduced `--chat-header-pill-bg` opacity: light 0.84→0.58, dark 0.56→0.48
- Reduced `--chat-summary-pill-bg` opacity: light 0.84→0.58, dark 0.56→0.48
- Reduced `--homepage-field-bg` opacity: light 0.88→0.58, dark 0.88→0.48
- Reduced `--homepage-field-hover-bg` opacity: light 0.94→0.76, dark 0.92→0.68
- Increased blur radius: 12px→18px (`--chat-header-pill-blur`, new `--homepage-field-blur`)
- Removed `backdrop-filter: none` from composer shell layers (`.composer-panel`, `.composer-row`, `.composer-tools`)
- Added `backdrop-filter`, `-webkit-backdrop-filter`, `will-change`, `translateZ(0)` to bottom controls
- Reversed `-webkit-backdrop-filter` / `backdrop-filter` order to ensure the standard property survives Lightning CSS deduplication
- Fixed bottom control hover to preserve `translateZ(0)` compositor promotion

### Proposal-and-confirmation gate

Completed.

### Validation

- `npm run build` — passes
- `npx eslint . --quiet` — zero warnings
- Built CSS verified: both standard `backdrop-filter` and `-webkit-backdrop-filter` present for header pill, summary bar chips, and bottom controls

### Commit

- pending

### Open Items

- no fresh device/emulator screenshot pass was run to visually verify the blur on Android WebView
