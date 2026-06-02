# 012 — Debug Apk Lan Share

**Period**: 2026-05-11

> Migrated from monolithic `40-handoff-log.md`. See git history for original context.


## 2026-05-11 — Debug APK LAN File Share Script

### Scope

Added a zero-dependency script that serves the debug APK build output directory over LAN via HTTP, for quick APK download from other devices without adb.

### Changes

- `scripts/serve-debug-apk.sh`: new script using Python 3 `http.server` to share `android/app/build/outputs/apk/debug/` on port 8000 (configurable via `-p`). Prints local LAN IP and access URL on start.

### Proposal-and-confirmation gate

Completed.

### Validation

- Smoke test: script starts, prints local IP (192.168.38.2) and URLs, Python HTTP server binds successfully.

### Commit

- pending
