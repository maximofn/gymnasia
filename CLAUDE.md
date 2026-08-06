# Repository Guidelines

## Project Structure & Module Organization
This repo contains a single Expo React Native mobile app.
- `apps/mobile`: Expo React Native app (`App.tsx`, `theme.ts`). This is the only application.
- `alimentos/`: repositorio de alimentos (JSONs con datos nutricionales). Ver skill `.claude/skills/generate-food-images.md` para generar JSONs.
- `ejercicios/`: repositorio de ejercicios (JSONs + imágenes generadas). Ver skill `.claude/skills/generate-exercise-images.md` para generar imágenes.

## Current Delivery Focus
- `apps/mobile` is the only product surface. There is no backend, web frontend, or database.
- All features must work fully local-first on mobile.
- Do not introduce backend or database dependencies.

## Design System Source Of Truth
- The system design reference is the attached `docs/design/Gimnasia Design System.png`.
- Every UI/UX change must follow that system design (colors, components, spacing, hierarchy, and visual style) unless the user explicitly requests an exception.
- Before closing any UI change, verify it is consistent with `docs/design/Gimnasia Design System.png`.

## Build, Test, and Development Commands
Run from repo root unless noted.
- `npm install`: install dependencies.
- `npm run dev:mobile`: start Expo dev server.
- `npm --workspace apps/mobile exec tsc --noEmit`: mobile type-check.

## Mobile Runbook (Expo Go)
- Goal: run `apps/mobile` reliably on a physical device with Expo Go (SDK 54).
- Clean start from repo root:
  1. `npm install`
  2. `npm --workspace apps/mobile run start -- --tunnel --clear`
  3. Wait for both:
     - `Tunnel connected.`
     - `Tunnel ready.`
  4. Confirm URL format is `exp://...exp.direct` (not `exp://192.168.x.x:8081`).
  5. Scan that QR in Expo Go.
- Important command detail:
  - Use `npm --workspace apps/mobile run start -- --tunnel --clear` (with the second `--`).
  - `npm run dev:mobile -- --tunnel --clear` may not always forward flags correctly in this workspace setup.
- If Expo Go shows `Failed to download remote update`:
  1. Ensure tunnel is actually enabled (`Tunnel ready` + `exp.direct` URL).
  2. Reset Expo Go app data/cache on Android (or reinstall Expo Go).
  3. Restart Metro with `--tunnel --clear`.
  4. Re-scan QR while Metro is still running.
- If Expo Go shows SDK incompatibility:
  - Ensure project is on SDK 54 dependency set (Expo Go installed version targets SDK 54).
- If Expo Go shows HTTP 500 from dev server:
  - Verify Babel preset exists and is compatible:
    `npm --workspace apps/mobile exec expo install babel-preset-expo`
  - Smoke-check bundle generation:
    `cd apps/mobile && npx expo export --platform android --dev`
- Useful checks:
  - `cd apps/mobile && npx expo config --type public` (verify `sdkVersion: 54.0.0`)
  - `npm --workspace apps/mobile exec tsc --noEmit`

## Browser Runbook (Web Preview)
- Goal: run `apps/mobile` in browser for UI validation.
- Required dependencies (SDK 54):
  - `react-dom`
  - `react-native-web`
  - `@expo/metro-runtime`
- Install/fix command:
  `npm --workspace apps/mobile exec expo install react-dom react-native-web @expo/metro-runtime`
- Start web dev server:
  `npm --workspace apps/mobile run web`
- If local environment blocks opening ports, validate web bundling without serving:
  `cd apps/mobile && npx expo export --platform web --dev`
- **CORS proxy for Anthropic (browser testing)**:
  - Browser CORS policy blocks direct calls to the Anthropic API.
  - A lightweight proxy is available at `apps/mobile/cors-proxy.py`.
  - The real implementation lives in `apps/anthropic_proxy/cors-proxy.py`; `apps/mobile/cors-proxy.py` is a symlink to that file.
  - Start it with the project virtualenv interpreter:
    `apps/anthropic_proxy/.venv/bin/python apps/mobile/cors-proxy.py`
  - If the virtualenv is missing, create/install it once:
    `cd apps/anthropic_proxy && uv venv .venv && .venv/bin/pip install fastapi uvicorn`
  - It runs on `http://127.0.0.1:8000` (the default `EXPO_PUBLIC_API_BASE_URL`).
  - Quick health check:
    `curl -sS http://127.0.0.1:8000/health`
  - The `/chat/providers/anthropic/messages` endpoint supports SSE streaming, so browser debugging can mirror the live Anthropic chat flow used by the mobile app.
  - Proxies `/chat/providers/anthropic/verify`, `/chat/providers/anthropic/messages`, and `/chat/providers/anthropic/models`.
  - OpenAI and Google providers work directly in browser without the proxy.
- Important caveats for this project:
  - SecureStore is not available in browser with the same guarantees as native.
  - Direct Anthropic chat from browser requires the CORS proxy above. OpenAI/Google can be used directly.

## Tablero de seguimiento — Deploy Runbook (`arquitectura-agente/`)
- Qué es: espejo manual de los tickets de Linear en <https://gymnasia-sable.vercel.app/>.
  Sitio estático (HTML/CSS/JS vanilla), sin build y sin backend. Los datos viven en
  `arquitectura-agente/data/board.json` y se actualizan a mano. Ver
  `arquitectura-agente/README.md`.
- **Un push a `main` NO despliega esta web.** La integración de Git de Vercel está
  inactiva en este repo (ver el Solved Problems Log). Hay que desplegar a mano.
- Desplegar a producción, desde la raíz del repo:
  ```bash
  npm exec --yes -- vercel@latest deploy --prod --yes --cwd arquitectura-agente
  ```
- La CLI de Vercel **no está instalada de forma permanente**; `npm exec` la baja al
  vuelo. La sesión ya está autenticada en `~/Library/Application Support/com.vercel.cli`,
  así que no hace falta `vercel login`. Comprobarlo sin desplegar:
  ```bash
  npm exec --yes -- vercel@latest whoami --cwd arquitectura-agente
  ```
- No usar `npx vercel`: el hook de rtk reescribe `npx` a `npm` y falla con
  `Unknown command: "vercel@latest"`. Usar `npm exec --` siempre.
- Antes de desplegar, pasar los tests:
  ```bash
  npm run test:board       # valida data/board.json (node --test, sin dependencias)
  npm run test:board:e2e   # E2E con Playwright sobre el sitio estático
  ```
- Verificar el despliegue comparando lo servido con lo local (Playwright no tiene
  salida a internet en el sandbox del agente, así que se valida con `curl`):
  ```bash
  curl -sS https://gymnasia-sable.vercel.app/ | grep -o '<title>[^<]*</title>'
  shasum -a 256 arquitectura-agente/data/board.json
  curl -sS https://gymnasia-sable.vercel.app/data/board.json | shasum -a 256
  ```
  `/index.html` devuelve un `Redirecting...` en vez del HTML: es `cleanUrls` de
  `vercel.json` redirigiendo a `/`. Comprobar siempre contra `/`, no `/index.html`.

## Coding Style & Naming Conventions
- TypeScript is `strict`; follow existing TS style: 2-space indentation, semicolons, double quotes.
- React components/types: `PascalCase`; functions/variables: `camelCase`.
- No repo-wide ESLint/Prettier config is committed yet; keep diffs consistent with surrounding code.

## Testing Guidelines
Automated unit/integration suites are not yet established. Minimum validation for PRs:
- mobile type-check: `npm --workspace apps/mobile exec tsc --noEmit`

When adding non-trivial logic, document manual verification steps explicitly.

## Commit & Pull Request Guidelines
History follows mostly Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`, `docs: ...`.
- Keep commit subjects imperative and scoped (e.g., `fix(mobile): pin Metro module resolution for monorepo`).
- After each modification, create a local commit. Do NOT `git push` to `main` unless the user explicitly asks.
- **Qué dispara realmente el build de Expo**: no todo push a `main`. El workflow
  `.github/workflows/build-apk.yml` filtra por rutas:
  ```yaml
  push:
    branches: [main]
    paths:
      - "apps/mobile/**"
      - "!apps/mobile/scripts/**"
      - "!apps/mobile/**/*.md"
  ```
  Es decir, solo compila si el push toca `apps/mobile/**`, y ni siquiera entonces
  si son únicamente scripts o markdown. Cambios en `.claude/`, `CLAUDE.md`,
  `arquitectura-agente/`, `ejercicios/`, `alimentos/` o `.github/` **no gastan
  build**. La cuota mensual de Expo es limitada, así que verifica el filtro antes
  de asumir que un push es caro — y pide confirmación igualmente.
- PR description should include: summary, impacted paths, commands executed, and screenshots for UI updates.

## Security & Configuration Tips
- Never commit secrets.
- Secrets live in the root `.env` (git-ignored). Keys present: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GITHUB_ISSUE_TOKEN`, `HF_TOKEN`.
- **Hugging Face token**: `HF_TOKEN` in the root `.env`. Required (HF PRO) by the `nano-banana` backend for exercise image generation. The script loads it via `load_dotenv(<repo>/.env)` and reads `os.environ["HF_TOKEN"]` (see `image-generation/generate_images.py` and skill `generate-exercise-image`). The `z-image-turbo` and `flux2-dev` backends work without it.

## Documentation Maintenance
- Keep `AGENTS.md` and root `CLAUDE.md` synchronized whenever repository instructions change.
- `AGENTS.md` es un link de `CLAUDE.md` por lo que modificando uno se debe actualizar el otro.
- Update `README.md` whenever the project structure, dependencies, or startup instructions change.

## Skill Maintenance Rule (Linear)
- **Cada descubrimiento nuevo sobre Linear implica actualizar la skill `linear-tickets`.**
  No dejes el hallazgo solo en la conversación: la siguiente sesión no lo tendrá.
- Aplica a: comportamientos no obvios de la API, trampas de shell o de formato,
  campos o mutaciones que el script aún no soporta, y flujos de trabajo que hayan
  funcionado bien (creación en lote, ediciones masivas, jerarquías).
- Si el hallazgo es una **capacidad que falta**, añádela como subcomando en
  `.claude/skills/linear-tickets/scripts/linear.py` y documéntala en `SKILL.md`.
- Si es una **trampa**, va a la sección "Trampas conocidas" de `SKILL.md` explicando
  el síntoma, no solo la solución — el síntoma es lo que permite reconocerla.
- Commitea el cambio de la skill junto con el trabajo que lo provocó.

## Agent Maintenance Rule
- Do NOT log feature implementations, UI changes, label renames, styling fixes, or any code change that is already reflected in the codebase. The code is the source of truth for those.
- Only add entries to the Solved Problems Log when the problem is a **non-obvious gotcha that could recur** despite the code being correct — e.g., external API constraints, environment/tooling traps, platform-specific behaviors, or dependency quirks.
- Ask yourself: "If the code is correct, could someone still hit this problem again?" If yes, log it. If no, don't.

## Solved Problems Log

Only non-obvious gotchas that could recur are kept here.

### Anthropic API version must be `2023-06-01`
- Gotcha: Anthropic rejects requests with newer version strings like `2025-01-01`. The only stable version is `2023-06-01`.
- Applies to: all Anthropic requests (verify, messages, models) and the CORS proxy (`apps/anthropic_proxy/cors-proxy.py`).

### Google `thinkingConfig` must be under `generationConfig`, not top-level
- Gotcha: Gemini REST API rejects `thinkingConfig` at the top level of the request body with `Unknown name "thinkingConfig": Cannot find field`.
- Fix: nest it as `generationConfig.thinkingConfig: { includeThoughts: true }`.

### Tunnel mode not applied when starting mobile from root alias
- Gotcha: `npm run dev:mobile -- --tunnel --clear` sometimes fails to forward the `--tunnel` flag through the workspace command chain, starting Metro in LAN mode instead.
- Fix: use `npm --workspace apps/mobile run start -- --tunnel --clear` directly. Verify `Tunnel ready` + `exp.direct` URL before scanning QR.

### Expo `--tunnel` fails with `remote gone away` — use manual ngrok + `EXPO_PACKAGER_PROXY_URL`
- Gotcha: `expo start --tunnel` uses `@expo/ngrok` internally, which can fail with `remote gone away` even though the system `ngrok` works fine (`ngrok diagnose` passes).
- Fix: launch ngrok and Metro separately:
  1. `ngrok http 8081 --request-header-add "ngrok-skip-browser-warning: true"`
  2. Get the public URL from `http://127.0.0.1:4040/api/tunnels`
  3. `EXPO_PACKAGER_PROXY_URL=<ngrok-url> npm --workspace apps/mobile run start -- --clear`
  4. In Expo Go: `exp://<ngrok-host>` (without port)
- Why `EXPO_PACKAGER_PROXY_URL`: without it, Metro tells Expo Go to fetch the bundle from `localhost:8081`, so Expo Go appends `:8081` to the ngrok URL and fails with "Packager is not running".
- Why `ngrok-skip-browser-warning`: ngrok free plan shows an interstitial HTML page that Expo Go can't handle, causing the download to hang forever on the splash screen.

### Metro 500 after SDK upgrade — missing `babel-preset-expo`
- Gotcha: after upgrading Expo SDK, Metro can return HTTP 500 because `babel-preset-expo` is not installed.
- Fix: `npm --workspace apps/mobile exec expo install babel-preset-expo`

### npm audit warnings from Expo/RN transitive dependencies
- State: `npm install` reports ~34 vulnerabilities from transitive deps (`fast-xml-parser`, `minimatch`, `tar`, `send`) in the Expo/RN toolchain.
- `npm audit fix --force` fails with `EOVERRIDE` due to pinned `react-native` override.
- Resolution: keep current stack; plan a dedicated Expo/RN major upgrade branch to reduce findings.

### JS timers pause in mobile background — workout timer must use wall-clock sync
- Gotcha: `setInterval` stops ticking when the app goes to background or the screen locks. A naive `elapsed += 1` per tick will drift or freeze.
- Fix: store `clock_last_tick_ms` (real timestamp) on each tick and on AppState transitions. On resume, compute delta from wall clock instead of counting ticks. Applied in `syncWorkoutSessionClock(...)` in `apps/mobile/App.tsx`.

### useRef values don't survive app restarts — persist to AsyncStorage if needed across launches
- Gotcha: a `useRef` initialized in a component is reset to its initial value whenever the app process is killed and relaunched. Any logic that compares "state at session start" vs "state now" will silently fail if the ref was set in a previous launch.
- Fix: if the ref's value must survive a restart (e.g. `workoutTemplateBeforeSessionRef`), persist it to `AsyncStorage` alongside the related state, and restore it during hydration. See `SESSION_TEMPLATE_SNAPSHOT_KEY` in `App.tsx`.

### Android asset filenames must not contain hyphens
- Gotcha: `expo-notifications` (and other native modules) reference sound/image assets as Android resource names. Android resource names only allow `[a-z0-9_]` — hyphens are invalid and cause build failures.
- Fix: rename files using underscores (e.g. `rest-finished.wav` → `rest_finished.wav`) and update every reference in code and `app.json`.

### Android Doze delays TIME_INTERVAL notifications — use DATE trigger for exact delivery
- Gotcha: `Notifications.scheduleNotificationAsync` with `SchedulableTriggerInputTypes.TIME_INTERVAL` uses `AlarmManager.set()` on Android, which Doze mode defersres until the next maintenance window. Observed delays of ~20s or complete suppression when the user returns to the app before the delayed delivery.
- Fix: use `SchedulableTriggerInputTypes.DATE` with an exact timestamp (`Date.now() + seconds * 1000`). DATE triggers use `AlarmManager.setExactAndAllowWhileIdle()` which bypasses Doze.
- Also: channel `importance` must be `MAX` (not `HIGH`) with `bypassDnd: true` and `lockscreenVisibility: PUBLIC` for the notification to wake the screen when the phone is locked.
- Note: Android caches notification channels by ID. If the channel already exists with lower importance from a previous app version, `setNotificationChannelAsync` will NOT upgrade it — the user must uninstall and reinstall the app to get the new channel settings.

### CI APK build cancelled by job timeout while EAS build sits in the free-tier queue
- Gotcha: `.github/workflows/build-apk.yml` runs `eas build` (waits for completion by default). On the Expo **free tier the build queue alone can exceed 60 min**, so a `timeout-minutes: 60` job gets cancelled mid-wait. Symptom: GitHub Actions run shows `cancelled` with `##[error]The operation was canceled` in the "Build APK on EAS" step; the later steps (Download APK / Create Release / Commit version bump) are `skipped`, so **no GitHub Release and no version-bump commit are produced** — but the EAS build itself keeps running/queued on Expo independently.
- Check: `eas build:view <build-id>` (or the Expo build URL printed in the logs). If `Status` is still `in queue`/`in progress`, the APK will finish later on Expo and can be downloaded directly from there, even though the CI release step already gave up.
- Fix: raised job `timeout-minutes` to 120 to give the queue margin. If it recurs, consider `eas build --no-wait` + publishing the release from an Expo build webhook, or build locally with the `build-apk` skill when in a hurry.

### Clearing `localStorage` does NOT reset the app on web — it also persists to `.dev-store.json`
- Gotcha: on web + `__DEV__`, `App.tsx` (`loadDevStoreFile` / `saveDevStoreFile`) mirrors the store to `apps/mobile/.dev-store.json` through a Metro middleware (`metro.config.js`, `/dev-store` endpoint) so data survives dev-server restarts. On boot it reads that file back, so wiping `localStorage` leaves the app fully populated. The file is served per dev server, not per origin, so `localhost:8081` and `127.0.0.1:8081` restore the *same* data even though their `localStorage` is separate.
- Fix: to test a clean install on web, empty the file too (`printf '{}' > apps/mobile/.dev-store.json`) and make sure no tab still has the app running — a live instance re-persists its in-memory state on the way out, silently undoing the wipe.
- Note: a fresh boot also re-runs the body-fat migration (`gymnasia.mobile.body_fat_migration_done`), which injects ~90 body-fat-only measurements. Expect the measurement count to differ from what you seeded.

### Vercel no despliega `arquitectura-agente/` en el push: la integración de Git está inactiva
- Gotcha: el repo *parece* conectado a Vercel — hay deployments de `vercel[bot]` en
  GitHub — pero los últimos son del **2 de marzo de 2026**. Todo lo publicado después
  se subió con la CLI desde local. Un push a `main` que toque `arquitectura-agente/`
  se queda en el repo: producción sigue sirviendo la versión anterior, sin ningún error
  visible en ninguna parte.
- Comprobar si un push ha desplegado algo:
  ```bash
  gh api repos/maximofn/gymnasia/deployments --jq '[.[].created_at] | max'
  ```
  Si esa fecha no se mueve tras el push, no ha desplegado: hay que lanzar la CLI a mano
  (ver "Tablero de seguimiento — Deploy Runbook").
- Fix definitivo pendiente: reconectar el proyecto en el dashboard de Vercel si se quiere
  despliegue automático.

## Post-Modification Workflow
After each modification, create a local commit:
```bash
git add -A && git commit -m '<description>'
```
Do NOT `git push` to `main` unless the user explicitly asks for it. Push only on
explicit request.

Un push a `main` **solo** dispara el build de APK si toca `apps/mobile/**`
(excluyendo `apps/mobile/scripts/**` y los `.md`). Ver el filtro de rutas en
"Commit & Pull Request Guidelines". La cuota mensual de Expo es limitada, así que
un push que sí entre en el filtro gasta build; el resto, no.
