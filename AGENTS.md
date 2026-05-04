# Repository Guidelines

## Project Structure & Module Organization
`src/` contains the web app. `src/App.tsx` is the main UI shell; keep reusable UI in `src/components/`, API and runtime logic in `src/services/` and `src/services/skills/`, shared helpers in `src/utils/`, and CSS in `src/styles/` plus the top-level `App.css` and `index.css`. Static assets live in `public/`, including `public/runtime-packages/`. Node helpers for packaging and Android builds live in `scripts/`. Capacitor-native code and generated Android assets live in `android/`. Reference notes and prompts are in `docs/`, and built-in skill bundles live in `builtin-skills/`.

## Build, Test, and Development Commands
Use `npm run dev` for the Vite development server. Run `npm run build` to type-check and create the production bundle in `dist/`. Use `npm run lint` before opening a PR. `npm run test:api` runs the repository’s API smoke test; it requires `API_BASE_URL` and `API_KEY`, and optionally `TEST_MODEL`. For mobile work, run `npm run android:sync` to copy the web build into Capacitor, then `npm run android:build:debug` or `npm run android:build:release`.

## Coding Style & Naming Conventions
This repo uses TypeScript, TSX, ES modules, and ESLint with `typescript-eslint`, `react-hooks`, and Vite React refresh rules. Follow the existing style: 2-space indentation, single quotes, no semicolons, and trailing commas where the formatter leaves them. Name React components in PascalCase (`ChatInputBox.tsx`), helpers in camelCase (`device-info.ts` exports), and keep service modules focused on one responsibility. Do not hand-edit generated output under `dist/` or `android/app/src/main/assets/public/`.

## Product Invariants
Cold-starting the app must always land in a fresh new conversation. Preserve conversation history, but do not restore the previously active conversation as the initially focused thread on cold launch unless the user explicitly asks to change this behavior.

## Testing Guidelines
There is no broad unit-test suite yet, so every change should at minimum pass `npm run lint` and any relevant build command. For API-facing changes, run `npm run test:api`. If you add native Android behavior, validate after `npm run android:sync` and keep any new JVM or instrumentation tests under `android/app/src/test/` or `android/app/src/androidTest/`.

## Commit & Pull Request Guidelines
Recent history uses Conventional Commit prefixes such as `feat:` and `fix:`; keep that format and write short, imperative subjects. PRs should explain the user-visible change, list the commands you ran, and include screenshots for UI or mobile layout updates. Call out changes to runtime packages, Android signing, or API configuration explicitly.

## Security & Configuration Tips
Never commit API keys, `.local` overrides, APK artifacts, or Android signing material. `android/keystore.properties` and `android/keystore/` are already ignored; keep it that way.
