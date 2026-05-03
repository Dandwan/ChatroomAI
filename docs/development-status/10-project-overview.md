# Project Overview

## Product Summary

ActiChat (`动话`, formerly `ChatroomAI`) is a hybrid web + Android chat application. The web UI is built with React/Vite, then packaged into Android with Capacitor. The app combines:

- multi-provider LLM chat
- a tag-based host protocol (`<progress>`, `<final>`, `<read>`, `<run>`, `<edit>`)
- built-in skill directories and runtime packages
- conversation persistence, workspace storage, and inline host execution logs

## Main Technical Areas

- `src/App.tsx`
  - app shell, prompt composition, streaming protocol handling, host action execution, settings UI
- `src/services/skills/`
  - read/run/edit protocol, skill host, runtime host, prompt defaults, native bridge
- `src/services/chat-storage/`
  - conversation persistence, cold-start history index, per-conversation lazy hydration, workspace files, active conversation handling
- `android/app/src/main/java/com/dandwan/chatroomai/SkillRuntimePlugin.java`
  - native runtime install/inspect/execute path, direct `run` execution, run session state, absolute-path file access for native `read` / `edit`
- `builtin-skills/`
  - built-in skill bundles, currently centered on `device-info` and `union-search`
- `codex-skills/union-search/`
  - the canonical Codex-native source package for `union-search`; built-in app consumption is expected to sync from here instead of treating `builtin-skills/union-search/` as the source of truth
- `public/runtime-packages/`
  - bundled Termux-based runtime archives
- `scripts/`
  - packaging, sync, Android build helpers

## Primary Build / Validation Commands

- `npm run lint`
- `npm run build`
- `node scripts/cap-sync-android.mjs`
- `$env:GRADLE_USER_HOME='C:\\Users\\Dandwan\\projects\\ChatroomAI\\.gradle-local-v120'; npm run android:gradle -- assembleDebug`

## Product Invariants

- Cold start must land in a fresh new conversation.
- Conversation history is preserved, but the previously active conversation must not become the initial focused thread on cold launch unless the product behavior is intentionally changed.
- Cold start should not block on eagerly reading every historical conversation document:
  - startup should render from a fresh placeholder plus stored history summaries
  - full historical transcripts should hydrate on demand when that conversation is opened
- Homepage archive metrics should come from persisted storage summaries, not from cold-start transcript walks.
- Response mode is conversation-owned, not global:
  - an empty conversation may switch between text mode and skill mode
  - the first user message locks that conversation to its current mode
  - later sends, append, regenerate, and transcript replay must keep using that locked conversation mode
- Default execution prompt behavior is now centered on `<run>`, but legacy prompt-storage migration still exists.
- Branding now uses `动话` for Chinese user-facing surfaces and `ActiChat` for English-facing project/config surfaces.
- Android package identifiers intentionally remain `com.dandwan.chatroomai` to preserve install/update continuity.
- `union-search` must evolve toward a Codex-native, host-independent skill that can be dropped into Codex and run as a complete equivalent skill without ChatroomAI / ActiChat private browser-extraction logic.
- The binding requirements and migration target for that work are defined in `docs/union-search-skill-requirements.md` and should be treated as mandatory engineering constraints, not optional design notes.

## Device / Debug Context

- Physical phone used in recent validation: `c3fec216`
- Emulator used in recent validation: `emulator-5554`
- Repo-local emulator skill exists under `.codex/skills/chatroomai-android-emulator-test/`
