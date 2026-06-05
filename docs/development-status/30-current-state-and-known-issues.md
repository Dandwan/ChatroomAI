# Current State And Known Issues

Last updated: 2026-06-05

## Run & Skill Runtime

- `run` is the primary execution action; `read` is file/dir inspection; `edit` is first-class text-file editing.
- Path resolution uses env var prefixes (`$skill/<name>`, `$workspace`, `$home`, absolute paths). Legacy `location`/`root` fields accepted for backward compat.
- Response mode is conversation-owned — first user message locks the mode. Persisted in conversation metadata (`schema 4`).
- Bundled runtime recovery is idempotent — execute bits self-heal on inspect/run paths.
- `runtime-shell` has been removed. `union-search` and `device-info` are the active built-in skills.
- `union-search` is now Codex-native and host-independent; canonical source at `codex-skills/union-search/`. Webpage extraction uses Defuddle, not host-provided logic.

See `20-run-and-skill-runtime.md` for full architecture.

## UI State

- All surfaces support light + dark mode with scoped CSS custom properties.
- Chat chrome uses shared `--chat-glass-blur` token (default 18px, user-configurable 0–40) for header pill, summary chips, composer controls, and drawer panel.
- Compositor layer promotion (`will-change: transform, backdrop-filter` + `translateZ(0)`) applied to all blur surfaces.
- `-webkit-backdrop-filter` + standard `backdrop-filter` both emitted (reverse order: webkit first so Lightning CSS keeps standard).
- Homepage sends use a CSS-animated overlay transition (920ms, `animationend` lifecycle).
- Active chat overlays (header, summary bar, composer) are truly fixed; message list has invisible inset padding for scroll range.
- `otherProvidersEnabled` setting (default `false`) controls visibility of non-ActiNet providers in account management and chat model selector.

## Storage & Startup

- Cold start lands directly in a fresh new conversation (no blocking loading screen).
- Conversation history is lazy-hydrated on demand via `index.json` summary index.
- Homepage archive metrics come from persisted storage summaries, not cold-start transcript scans.
- Chat-storage schema is at version `4`.

## Branding

- Chinese user-facing: `动话`
- English-facing project/config: `ActiChat`
- Android package: `com.dandwan.chatroomai` (preserved for install/update continuity)

## Current Build & Deploy State

- Web: `npm run build` (Vite), `npm run lint` (ESLint), `npx tsc -b` (TypeScript)
- Android sync: `node scripts/cap-sync-android.mjs`
- Android build: Gradle via `.gradle-local-v120`, JDK 21 required (`JAVA_HOME=/opt/android-studio/jbr`)
- Physical phone: `c3fec216`, Emulator: `emulator-5554`
- Release APK: `android/app/build/outputs/apk/release/app-release.apk`
- Debug APK LAN share: `scripts/serve-debug-apk.sh`
- Package: `versionName=1.5.0`, `versionCode=1500`

## Known Issues

1. **lint**: Persistent `react-hooks/set-state-in-effect` error at `src/App.tsx:1099` — unresolved.
2. **Android WebView `backdrop-filter`**: Known rendering risk — blur may silently drop on certain WebView versions. Current blur implementation uses `will-change` compositor promotion as mitigation but real-device verification is sparse.
3. **Android install**: Phone `c3fec216` may intermittently fail streamed install with `INSTALL_PARSE_FAILED_NOT_APK`. Workaround: `adb install --no-streaming -r`.
4. **Emulator x86_64**: Bundled Node runtime is AArch64-only — `union-search` cannot execute on x86_64 emulation.
5. **Gradle build**: Requires JDK 21; system default OpenJDK 26 incompatible. Google Maven may need Aliyun mirror on this host due to TLS handshake failures.
6. **`android/gradlew`**: Tracked with CRLF line endings — requires LF wrapper on Linux.
7. **Duplicate asset merge**: Repeated debug rebuilds after `cap sync` can intermittently hit duplicate asset merge errors under `public/builtin-skills/union-search/`. Workaround: `clean` → `assembleDebug`.
8. **Emulator system bar**: White status-bar background visible above WebView — not yet matching prototype appearance.

## Cloud Server (`cloud-server/`)

The project now includes a **cloud server** (API proxy gateway) at `cloud-server/`. It acts as a middleware layer between the client app and upstream LLM APIs.

### Architecture
- **Node.js + TypeScript + Express** backend
- **SQLite** (sql.js, WASM-based) for data persistence
- **Admin UI**: Separate Vite + React app, served as static files by Express
- Modules: `auth/`, `proxy/`, `upstream/`, `admin/`, `db/`, `plugin/`, `watcher/`, `ws/`

### Core Capabilities
- User authentication (username/email + password) with auto-generated API keys (`csk_` prefix)
- User registration with auto-login, username/email dedup, IP brute-force protection
- **Multi-API-type proxy**: OpenAI, Anthropic, Gemini — transparent format conversion (request/response/SSE stream)
- **Native API endpoints**: 
  - `POST /v1/chat/completions` — OpenAI Chat Completions API
  - `POST /v1/messages` — Anthropic Messages API
  - `POST /v1beta/models/:model/generateContent` + `:streamGenerateContent` — Gemini API (both `alt=sse` and `streamGenerateContent` streaming modes)
- **Multi-format model list**: `GET /v1/models` (OpenAI/Anthropic), `GET /v1beta/models` (Gemini)
- **TLS/HTTPS**: Built-in HTTPS support with configurable cert/key (opt-in)
- **Proxy forwarding**: HTTP/HTTPS/SOCKS5 upstream proxy with per-upstream override
- **Config hot-reload**: `fs.watch`-based watcher for `config.json` changes (no-restart config update)
- **WebSocket**: `/v1/ws` endpoint with optional API Key authentication
- **Per-key health**: Independent key health tracking, fault tolerance, retry with same-upstream key rotation
- **Admin dashboard**: Usage stats, hourly charts, availability monitoring, **real-time SSE log stream**, **key health overview**, server metrics
- Plugin system for extensibility

### Build & Run
- `cd cloud-server && npm run dev` — development server
- `cd cloud-server/admin-ui && npm run build` — build admin UI
- Config via environment variables or `cloud-server/config.json`

## Remaining Follow-Up Items

- Continue front-end redesign polish (active-chat, settings, drawer states on-device verification).
- Replay full in-app `union-search` conversation end-to-end through normal chat loop.
- Run one complete model-driven `<read>` / `<edit>` / `<run>` conversation to validate the full parser/executor/native bridge path.
- Source or build an x86_64-compatible Node runtime for emulator testing.
- Investigate `ChatroomAI_API_35_ARM64` AVD failure to attach to `adb`.
- Decide whether `.internal` helper scripts in `builtin-skills/` should be simplified away.
- If Zhihu正文 extraction is needed, implement stronger browser/session strategy beyond static headers.

## Worktree Reality

- The repository is very dirty — many unrelated modified files.
- Large local caches (`.gradle-local-v120/`, `node_modules/`, `.local/`) intentionally excluded from cleanup.
- `.gitignore` covers root `/.tmp-*` captures and local APK copies.
- Do not use broad cleanup or revert commands unless explicitly requested.
