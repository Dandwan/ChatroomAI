# 014 — Cloud Server (API Proxy Gateway)

**Date**: 2026-06-03

## Scope

Added a complete cloud server backend for ActiChat, providing API proxy gateway capabilities. This is a new feature that introduces a server-side component to what was previously a pure client-side application.

## Changes

### New: `cloud-server/` directory
A standalone Node.js + TypeScript backend service with:

**Core infrastructure:**
- `package.json`, `tsconfig.json` — Node.js ESM project with Express, sql.js, bcryptjs, jsonwebtoken
- `src/index.ts` — entry point with graceful shutdown
- `src/config.ts` — env var + JSON config management
- `src/app.ts` — Express app assembly with middleware and route mounting
- `src/app-context.ts` — shared application context (db, repos, config injection)
- `src/types.ts` — shared TypeScript types (User, Upstream, UsageLog, HealthCheck, plugins)

**Database layer (`db/`):**
- `database.ts` — sql.js (WASM-based SQLite) initialization with auto-save, chosen over better-sqlite3 which failed to compile on Node v26
- `migrations.ts` — schema version 1 (users, admin_users, upstreams, upstream_api_keys, usage_logs, health_checks tables)
- `helpers.ts` — `queryOne()` / `queryAll()` wrappers for sql.js prepared statements
- `repositories/` — UserRepo, UpstreamRepo, UsageRepo, HealthCheckRepo (data access)

**Authentication (`auth/`):**
- `auth-service.ts` — login with username/email, bcrypt password verification, JWT generation, API key generation (`csk_` prefix + 48 base64url chars), initial admin seed
- `auth-routes.ts` — `POST /api/auth/login`, `GET /api/auth/me`
- `middleware.ts` — API key authentication (Bearer token → user lookup), JWT admin auth

**Proxy core (`proxy/`):**
- `distribution.ts` — fill mode (first available key) and round-robin mode (least-used key) selection with in-memory counters
- `upstream-selector.ts` — priority-based upstream selection with health awareness, priority group failover, unhealthy marking
- `request-forwarder.ts` — streaming SSE passthrough and non-streaming JSON forward with token extraction
- `rate-limiter.ts` — per-user RPM/TPD rate limiting with rolling window counters
- `proxy-routes.ts` — `POST /v1/chat/completions` (OpenAI-compatible) and `GET /v1/models`

**Health checking (`upstream/`):**
- `health-checker.ts` — 10-minute interval health checks, checks `/v1/models` endpoint, retries unhealthy upstreams and fully-down priority groups, records results to DB, auto-cleans records older than 7 days

**Admin API (`admin/`):**
- `admin-routes.ts` — admin login, usage stats (summary + hourly + per-upstream), availability stats (1h/3h/24h + hourly), upstream CRUD + key management, user CRUD with rate limit adjustment

**Plugin system (`plugin/`):**
- `plugin-types.ts` — `CloudServerPlugin` interface (onBeforeProxy, onAfterProxy, onHealthCheck, onDestroy)
- `plugin-loader.ts` — dynamic ESM plugin loading from `plugins/` directory

**Admin UI (`admin-ui/`):**
- Vite + React SPA with Chart.js for line charts
- Pages: Login, Dashboard (usage + availability charts), Upstream Management, User Management
- Built output at `cloud-server/src/admin/public/`, served by Express under `/admin/`

### Modified: `src/` (App frontend)
- **`src/components/CloudLoginPage.tsx`** — new login form component matching editorial design language
- **`src/services/cloud-auth.ts`** — cloud authentication service (login, localStorage persistence, session management)

### Modified: `.gitignore`
- Added cloud-server build artifacts and data directory

### Modified: `docs/development-status/30-current-state-and-known-issues.md`
- Added Cloud Server section documenting architecture and capabilities

## Decision Gate

- Proposal presented: Yes (comprehensive plan reviewed and approved)
- User confirmation received: Yes

## Key Design Decisions

1. **sql.js over better-sqlite3**: better-sqlite3 native compilation failed on Node.js v26 due to V8 API breaking changes (GetPrototype, GetIsolate, PropertyCallbackInfo::This). sql.js is WASM-based and works on any Node version.

2. **path-to-regexp v8 syntax**: Express 5 uses path-to-regexp v8 which requires `{*path}` syntax for catch-all routes instead of `*`.

3. **In-memory rate limit counters**: Rate limiting uses in-memory Maps with periodic cleanup rather than DB writes per request, for performance.

4. **Health check uses `/v1/models` endpoint**: Lightweight check using the standard OpenAI-compatible models endpoint with 10s timeout.

## Validation

- `npx tsc --noEmit` — cloud-server: zero errors
- `npx tsc --noEmit` — admin-ui: zero errors
- `npx tsc --noEmit` — main app: zero errors
- `vite build` — admin-ui: built successfully (377 KB JS, 5.3 KB CSS)
- Integration test — all endpoints verified:
  - `GET /health` → `{"status":"ok"}`
  - `POST /api/admin/login` → JWT token returned
  - `GET /api/admin/upstreams` → empty list
  - `POST /api/admin/upstreams` → upstream created with API key
  - `GET /admin/` → 200 (Admin UI served)

## Commit

- Pending

## Known Issues / Skipped

- Admin UI has no dark/light mode toggle (dark-only by design for admin panel)
- Chart.js dependency adds ~377 KB to admin UI bundle
- No Docker build configuration (deferred per plan)
- Cross-origin requests from Android WebView may need explicit CORS configuration for production

## Open Questions / Risks

- sql.js WAL mode file-save strategy: manual `autoSave()` calls on every write. Under heavy concurrent writes, this could cause file corruption — should migrate to better-sqlite3 when it supports Node v26, or add a write queue
- Rate limit in-memory counters are per-process; multi-instance deployment would need Redis or shared state

## Next Step

- Deploy cloud-server to a production environment and configure domain/DNS
- Add SSL/TLS termination (nginx reverse proxy or built-in HTTPS)
- Add a `/api/auth/register` endpoint when ready to accept user self-registration
- Consider Docker multi-stage build for streamlined deployment
