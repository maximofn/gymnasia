# Repository Guidelines

## Cómo referirse a los tickets
- **Nunca cites un ticket solo por su identificador.** Escribe siempre
  `GYM-X (ticket para hacer Y)`, con una descripción breve de qué trata.
- Motivo: el mantenedor no se sabe los números de memoria, y un `GYM-54` suelto
  obliga a ir a Linear a mirarlo para entender la frase.
- Aplica a las respuestas en el chat, a los mensajes de commit, a las
  descripciones de PR y a la documentación. Ejemplo:
  `GYM-45 (ticket para añadir confirmación humana en tools con efectos)`.

## Cambios en las instrucciones del agente: avisar y esperar aprobación
- **Cuando un cambio toque `prompts/` o `policy/health-safety/`, para y avisa.**
  Son las instrucciones que el modelo lee y obedece, y el repositorio las gobierna
  aparte del código: el check `gymnasia/policy-promotion` se queda en amarillo
  (`PENDING`) hasta que esa política se promociona a propósito.
- Qué hacer, en este orden:
  1. **Avisar en lenguaje natural**, sin jerga. Nada de `policy-promotion está
     PENDING`: escribe qué ha pasado y por qué, como se lo contarías a alguien
     que no ha visto el fichero.
  2. **Explicar el cambio en lenguaje natural**: qué le permitías o le prohibías
     hacer al agente antes, qué le permites o le prohíbes ahora, y qué consecuencia
     tiene para el usuario de la app. El diff no vale como explicación.
  3. **Esperar a que el mantenedor diga explícitamente que lo aprueba.**
- **Nunca** lances la promoción (`promote-policy.yml`), ni fusiones la PR, ni saques
  el cambio a otra rama para esquivar la puerta, sin esa aprobación explícita. Un
  «adelante» sobre otro asunto no cuenta.
- Motivo: cambiar lo que un agente tiene permitido hacer es más arriesgado que
  cambiar código, porque el diff no muestra las consecuencias. La puerta está
  echada a propósito; tratarla como un trámite anula su razón de ser.
- El detalle del mecanismo vive en `docs/security/prompt-policy-governance.md`.

## Project Structure & Module Organization
This repo contains an Expo React Native mobile app and un Worker de Cloudflare de apoyo.
- `apps/mobile`: Expo React Native app (`App.tsx`, `theme.ts`). This is the only application.
- `alimentos/`: repositorio de alimentos (JSONs con datos nutricionales). Ver skill `.claude/skills/generate-food-images.md` para generar JSONs.
- `apps/feedback-worker`: Worker de Cloudflare que recibe incidencias de la app y
  crea issues en un repositorio privado. Ver su `README.md` para despliegue,
  secretos, rotación y apagado.
- `ejercicios/`: repositorio de ejercicios (JSONs + imágenes generadas). Ver skill `.claude/skills/generate-exercise-images.md` para generar imágenes.

## Current Delivery Focus
- `apps/mobile` is the only product surface. There is no web frontend or database.
- All features must work fully local-first on mobile.
- **No hay backend obligatorio.** La app funciona entera sin ningún servicio: si
  el backend está caído o sin configurar, la funcionalidad afectada degrada en
  silencio y nada más se rompe. Si alguna vez la app deja de arrancar o de
  funcionar porque un servicio no responde, el diseño está mal.
- La **única** excepción autorizada es `apps/feedback-worker` (GYM-54, ticket
  para sustituir los escritores no-op de GitHub Issues por un flujo verificable):
  crear una issue exige una credencial de escritura en GitHub y un cliente
  estático nunca puede llevarla. Ver `apps/feedback-worker/README.md`.
- No introduzcas ninguna otra dependencia de backend o de base de datos sin que
  exista un ticket que autorice la excepción de forma explícita.

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
  - If the virtualenv is missing, create it once from the declared dependencies:
    `uv sync --project apps/anthropic_proxy --extra dev`
  - Its contract, status codes, pagination policy and truncated-stream signal
    are documented in `apps/anthropic_proxy/README.md`. Run its suite with
    `npm run test:proxy`.
  - Keep it as a **single file**: the documented startup runs it through the
    symlink, so `sys.path[0]` is `apps/mobile/`, not the proxy directory. A
    sibling-module import would crash on startup while passing green in the
    tests, which load it by its real path.
  - It runs on `http://127.0.0.1:8000`; set `EXPO_PUBLIC_API_BASE_URL` to that
    URL when you want Anthropic in the browser. Production web builds leave this
    variable empty by default because no proxy is bundled.
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
- En un worktree, `.vercel/project.json` puede faltar porque está ignorado por Git.
  Antes de desplegar, confirma que contiene `"projectName":"gymnasia"`. Si falta
  o apunta a otro proyecto, enlázalo explícitamente antes del deploy:
  ```bash
  npm exec --yes -- vercel@latest link --yes --project gymnasia --cwd arquitectura-agente
  ```
  La salida correcta del deploy empieza por `Deploying gymnasia` y termina
  aliando `https://gymnasia-sable.vercel.app`. Si muestra `Searching for existing
  projects` o `Created`, detén el flujo: crearía un proyecto distinto.
- La CLI de Vercel **no está instalada de forma permanente**; `npm exec` la baja al
  vuelo. La sesión suele estar autenticada en
  `~/Library/Application Support/com.vercel.cli`. Comprobarlo sin desplegar:
  ```bash
  npm exec --yes -- vercel@latest whoami --cwd arquitectura-agente
  ```
  Si devuelve `The specified token is not valid`, la sesión ha caducado: ejecutar
  `npm exec --yes -- vercel@latest login`, completar el acceso interactivo y repetir
  el deploy. Reintentar el despliegue sin renovar la sesión no lo corrige.
  Si `whoami` sí devuelve el usuario pero `deploy` falla inmediatamente con
  `Not authorized`, vuelve a enlazar explícitamente el mismo proyecto con
  `npm exec --yes -- vercel@latest link --yes --project gymnasia --cwd arquitectura-agente`.
  La CLI renovará el token OIDC local; verifica que diga `Linked .../gymnasia` y
  no `Created` antes de repetir el deploy.
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

## Backend de incidencias — Deploy Runbook (`apps/feedback-worker/`)
- Qué es: Worker de Cloudflare que custodia el PAT de GitHub y crea las issues
  que propone la app. Plan gratuito, sin caducidad. Detalle completo en
  `apps/feedback-worker/README.md`.
- **Un push a `main` NO lo despliega.** Igual que Vercel en este repo, hay que
  lanzar la CLI a mano:
  ```bash
  npm --workspace apps/feedback-worker run deploy
  ```
- `wrangler` **no está instalado**: se baja al vuelo con `npm exec --yes --`,
  igual que la CLI de Vercel. No usar `npx`: el hook de rtk lo reescribe a `npm`.
- El secreto `GITHUB_TOKEN` vive solo en Cloudflare (`wrangler secret put`).
  **Nunca** en el repositorio, que es público, ni en el bundle de la app.
- Verificar tras desplegar:
  ```bash
  curl -sS https://gymnasia-feedback.maximofn.com/health
  ```
- **Trampa del subdominio**: tiene que ser de un solo nivel. El certificado
  gratuito Universal SSL de Cloudflare cubre `maximofn.com` y `*.maximofn.com`,
  pero **no** `*.gymnasia.maximofn.com`: los comodines no se encadenan. Por eso
  `gymnasia-feedback.maximofn.com` y no `feedback.gymnasia.maximofn.com`, que
  exigiría Advanced Certificate Manager (de pago).
- Cambiar la URL de producción obliga a tocar `apps/mobile/app.config.ts` **y**
  `scripts/data-inventory/inventory.json`: el escáner reconoce el host por su
  literal y `npm run check:data-inventory` falla si no está declarado.

## Coding Style & Naming Conventions
- TypeScript is `strict`; follow existing TS style: 2-space indentation, semicolons, double quotes.
- React components/types: `PascalCase`; functions/variables: `camelCase`.
- No repo-wide ESLint/Prettier config is committed yet; keep diffs consistent with surrounding code.

## Testing Guidelines
The agent has a deterministic Vitest suite isolated from Expo and provider APIs:
- deterministic tests: `npm test`
- backend de incidencias: `npm --workspace apps/feedback-worker run test`
- proxy CORS de Anthropic (pytest, sin red ni clave): `npm run test:proxy`
- browser E2E with a fake OpenAI provider: `npm run test:agent:e2e`
- published privacy policy E2E: `npm run test:privacy:e2e` (exports the web build and
  reads it with a clean browser context; `PRIVACY_E2E_SKIP_EXPORT=1` reuses `dist/`)
- data inventory guard rail: `npm run check:data-inventory`, `npm run test:data-inventory`
- generated privacy policy: `npm run check:legal`, `npm run test:legal`, `npm run sync:legal`
- mobile type-check: `npm --workspace apps/mobile exec tsc --noEmit`
- LLM eval boundary: `npm run test:llm` (reserved for LangSmith; never part of commit-blocking CI)

CI runs `npm test` and the mobile type-check without network, provider keys, or
LLM calls. The Anthropic proxy suite runs in its own Python job of
`agent-tests.yml` — it is the only Python in CI, kept apart so the Node job is
unaffected. Add deterministic bugs as regression fixtures/tests under
`apps/mobile/agent/`. Use the reusable QA checklist and closure policy in
`docs/testing/agent-testing.md` for non-trivial tickets.

Every new Linear ticket must include a `## Plan de pruebas` section evaluating
unit tests, E2E, fake-provider integration, contract tests, regression tests,
and fuzzing/property-based tests. Use a concrete case or `No aplica: <motivo>`
for every category; `.claude/skills/linear-tickets/scripts/linear.py create`
enforces this before creating the issue.

## Commit & Pull Request Guidelines
History follows mostly Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`, `docs: ...`.
- Keep commit subjects imperative and scoped (e.g., `fix(mobile): pin Metro module resolution for monorepo`).
- After each modification, create a local commit on a topic branch, push that
  branch and open a pull request. Never push directly to `main`: its ruleset
  requires `prompt-policy` and `gymnasia/owner-authorization`.
- Pull requests authored by `@maximofn` are authorized automatically. An
  external PR that touches a sensitive path from `.github/prompt-policy.json`
  requires a current-commit approval from `@maximofn`; all merges remain manual.
- If a PR touches build-triggering files under `apps/mobile/**`, ask for explicit
  confirmation before merging because Expo quota is limited.
- **El entorno de build móvil por defecto es Producción.** Mientras el mantenedor
  pruebe directamente en Producción y no haya usuarios, interpreta cualquier
  petición genérica de compilar, generar un APK o lanzar una build como
  `production-apk` (APK instalable con configuración de Producción). Usa
  `production` solo cuando se pida un AAB para Google Play. No lances ni apruebes
  una build `staging` salvo que el mantenedor solicite Staging explícitamente. Si
  el push a `main` deja esperando la build automática de Staging, no la apruebes
  por defecto: lanza y aprueba manualmente `production-apk`.
- **Qué dispara realmente el build de Expo**: no todo push a `main`. El workflow
  `.github/workflows/build-apk.yml` filtra por rutas:
  ```yaml
  push:
    branches: [main]
    paths:
      - "apps/mobile/**"
      - "!apps/mobile/scripts/**"
      - "!apps/mobile/**/*.md"
      - "!apps/mobile/public/**"
  ```
  Es decir, solo compila si el push toca `apps/mobile/**`, y ni siquiera entonces
  si son únicamente scripts, markdown o ficheros de `public/`. Cambios en
  `.claude/`, `CLAUDE.md`, `arquitectura-agente/`, `ejercicios/`, `alimentos/` o
  `.github/` **no gastan build**. `apps/mobile/public/` tampoco: solo lo consume
  `expo export --platform web`, EAS no lo empaqueta en el AAB, y ahí vive la
  política de privacidad publicada, que debe poder republicarse sin gastar cuota.
  El plan de Expo es de pago desde septiembre de 2026, así que una build ya no es
  el recurso escaso que era; sigue siendo finita, así que verifica el filtro antes
  de asumir que un push es caro — y pide confirmación igualmente.
- PR description should include: summary, impacted paths, commands executed, and screenshots for UI updates.

## Security & Configuration Tips
- Never commit secrets.
- Secrets live in the root `.env` (git-ignored). Keys present: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `GITHUB_ISSUE_TOKEN`, `HF_TOKEN`.
- **Hugging Face token**: `HF_TOKEN` in the root `.env`. Required (HF PRO) by the `nano-banana` backend for exercise image generation. The script loads it via `load_dotenv(<repo>/.env)` and reads `os.environ["HF_TOKEN"]` (see `image-generation/generate_images.py` and skill `generate-exercise-image`). The `z-image-turbo` and `flux2-dev` backends work without it.

## Documentation Maintenance
- **El texto legal tiene una única fuente**: `docs/legal/privacy-policy.{es,en}.md`.
  El HTML publicado (`apps/mobile/public/{privacidad,privacy}/`) y el módulo que
  consume la app (`apps/mobile/agent/generated/legalCopy.generated.ts`) son
  generados: no se editan a mano. Tras tocar la política, `npm run sync:legal`;
  `npm run check:legal` falla en CI si los artefactos no corresponden. Nunca
  escribas el descargo sanitario ni la URL de la política como literales en
  componentes, igual que con `apps/mobile/agent/aiTransparency.ts`.
- **Cualquier cambio que toque datos tratados** (una clave de almacenamiento, un
  host, un permiso, lo que se envía a un proveedor, lo que borra el reset) exige
  actualizar `scripts/data-inventory/inventory.json` y recorrer
  `docs/legal/privacy-change-checklist.md`. `npm run check:data-inventory` falla si
  el inventario deja de describir el código.
- Update `README.md` whenever the project structure, dependencies, or startup instructions change.

## Repository Documentation and Skill Routing (OpenWiki)
- `openwiki/` es la wiki técnica generada del repositorio: documenta la
  arquitectura, los componentes, los flujos, las integraciones, las operaciones,
  las pruebas y los riesgos conocidos. Su punto de entrada es
  `openwiki/quickstart.md`.
- Para comprender una parte del sistema o localizar el código responsable,
  consulta primero `openwiki/quickstart.md` y la página temática correspondiente.
  Usa la wiki como mapa de navegación y verifica después las conclusiones en el
  código y las pruebas, que son la fuente de verdad.
- Para cualquier tarea de operación o mantenimiento de OpenWiki, carga
  `.claude/skills/openwiki/SKILL.md`. Sus reglas de seguridad, compatibilidad y
  automatización viven solo en esa skill; no las dupliques aquí.

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
- The proxy side is now pinned by a contract test, so an "update" to a newer string fails the suite instead of failing in production.

### Starlette applies middleware in reverse order of registration
- Gotcha: `add_middleware` inserts at position 0, so the **last** middleware added is the **outermost**. In `cors-proxy.py`, `CORSMiddleware` is registered *after* the body-size limiter on purpose: otherwise a `413` or `422` is returned without CORS headers and the browser reports only a generic "Failed to fetch", with nothing in the response the page can read.
- Symptom: the error is perfectly visible with `curl` and in `TestClient` (neither enforces origin policy), and invisible in the browser. Verify this class of change in a real browser, not only in tests.

### FastAPI validation errors don't match the shape the app reads
- Gotcha: FastAPI answers a `422` with `{"detail": [...]}` — a **list**. `extractErrorMessage` (`App.tsx`) and `errorMessage` (`agent/providerStreamParsers.ts`) read `error.message` first and then `detail` **as a string**, so an unreshaped `422` surfaces as an unusable message.
- Fix: `cors-proxy.py` installs a `RequestValidationError` handler that returns `{"error": {"type", "message"}}`. Any new endpoint returning errors must use that shape.

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
- **Outdated since GYM-191**: a DATE trigger no longer guarantees exact delivery. See the entry below.

### `USE_EXACT_ALARM` is banned by Google Play — DATE triggers degrade to inexact alarms
- Gotcha: `android.permission.USE_EXACT_ALARM` is auto-granted on install, so it made DATE triggers reliably exact — but Google Play restricts it to apps whose **core function** is an alarm clock or calendar. Declaring it in a workout app gets the AAB rejected in review. It was removed in GYM-191.
- Consequence: `ExpoSchedulingDelegate.setupAlarm` checks `alarmManager.canScheduleExactAlarms()` and silently falls back from `setExactAndAllowWhileIdle()` to `setAndAllowWhileIdle()`. Exactness now depends on the user granting `SCHEDULE_EXACT_ALARM` ("Alarmas y recordatorios"), which Android 14+ does **not** grant by default. Do not re-add `USE_EXACT_ALARM` to "fix" late notifications — it will fail review.
- `SCHEDULE_EXACT_ALARM` is fine to declare: it is not Play-restricted and is user-grantable.
- `expo-notifications` does **not** expose `canScheduleExactAlarms()` to JS, so the app cannot read that permission's state. Punctuality is inferred by comparing the scheduled `expectedAt` (carried in the notification payload) against actual delivery.
- Guard rail: `npm run check:android-permissions` fails if the permission returns via `app.json` or via a dependency's manifest. The approved list lives in `scripts/android-permissions/policy.json`.
- **Manifest merger trap**: `expo.android.blockedPermissions` makes prebuild emit `<uses-permission android:name="…USE_EXACT_ALARM" tools:node="remove"/>`. So the **source** manifest legitimately contains the string. Absence must be verified on the **merged** manifest of the artifact — grepping the source manifest gives a false positive.

### Una build parada casi nunca es la cola de Expo: mira antes la puerta de aprobación
El plan de Expo **es de pago desde septiembre de 2026**. La cola del plan gratuito, que
antes explicaba casi cualquier espera, ya no es la sospechosa por defecto: empezar por ahí
hace perder el tiempo. Diagnostica en este orden.

**1. ¿Hay una ejecución anterior esperando aprobación?** Es la causa más frecuente y la
menos visible. `build-apk.yml` declara `concurrency: android-production-release` con
`cancel-in-progress: false`, así que las builds se ejecutan de una en una y en orden. Si
una queda en estado `waiting` —esperando la aprobación del entorno `Production`— **bloquea
todas las siguientes de forma indefinida**, y las que se apilan detrás aparecen como
`cancelled` sin haber ejecutado un solo job. Verificado el 5 de septiembre de 2026: una
ejecución del día 3 llevaba dos días sin aprobar y había cancelado por tiempo las dos
builds posteriores.

El síntoma que la delata es que el run está en `pending` y **no tiene ningún job**, ni
siquiera empezado:
```bash
gh run list --workflow=build-apk.yml --limit 6 \
  --json databaseId,status,conclusion,createdAt \
  --jq '.[] | "\(.databaseId) \(.status) \(.conclusion // "-") \(.createdAt)"'
```
Cualquier fila en `waiting` es la que manda, por antigua que sea.

**Trampa: `gh run cancel` no la desbloquea.** Sobre una ejecución detenida en la puerta de
un entorno no hace nada; el estado sigue en `waiting` y el comando responde correctamente,
que es lo que despista. Hay que **rechazar el despliegue**, que es una decisión del
mantenedor y no se toma por iniciativa propia:
```bash
gh api repos/maximofn/gymnasia/actions/runs/<run_id>/pending_deployments \
  --jq '.[] | {id: .environment.id, nombre: .environment.name}'
gh api -X POST repos/maximofn/gymnasia/actions/runs/<run_id>/pending_deployments \
  -f state=rejected -F 'environment_ids[]=<id>' -f comment="<motivo>"
```
Las comillas simples en `environment_ids[]` son obligatorias: sin ellas zsh intenta
expandir los corchetes y falla con `no matches found`. Aprobar es el mismo comando con
`state=approved`.

**2. Si ya está corriendo y muere por tiempo**, entonces sí puede ser la espera de EAS.
`eas build` espera a que termine, así que un job que agota `timeout-minutes` (hoy 120) sale
como `cancelled` con `##[error]The operation was canceled` en el paso "Build APK on EAS";
los pasos siguientes (Download APK / Create Release / Commit version bump) quedan
`skipped`, así que **no hay Release ni commit de versión** — pero la build sigue viva en
Expo por su cuenta. Compruébalo con `eas build:view <build-id>` o la URL que imprime el
log: si sigue `in queue`/`in progress`, el APK acabará y se descarga desde Expo. Si esto
se repite pese al plan de pago, considera `eas build --no-wait` publicando la release desde
un webhook de Expo, o compila en local con la skill `build-apk`.

### Clearing `localStorage` does NOT reset the app on web — it also persists to `.dev-store.json`
- Gotcha: on web + `__DEV__`, `App.tsx` (`loadDevStoreFile` / `saveDevStoreFile`) mirrors the store to `apps/mobile/.dev-store.json` through a Metro middleware (`metro.config.js`, `/dev-store` endpoint) so data survives dev-server restarts. On boot it reads that file back, so wiping `localStorage` leaves the app fully populated. The file is served per dev server, not per origin, so `localhost:8081` and `127.0.0.1:8081` restore the *same* data even though their `localStorage` is separate.
- Fix: to test a clean install on web, empty the file too (`printf '{}' > apps/mobile/.dev-store.json`) and make sure no tab still has the app running — a live instance re-persists its in-memory state on the way out, silently undoing the wipe.
- Note: a fresh boot used to re-run a body-fat migration that injected ~90 body-fat-only measurements. It was removed in GYM-190 because the data was not the user's, so a clean install now starts with no measurements on mobile. On web, the first load still seeds demo data via `createWebSeedStore()`.

### Hay DOS proyectos de Vercel, y la política de privacidad vive en el segundo
- Gotcha: `gymnasia` y `gymnasia-web` son proyectos distintos y es fácil confundirlos,
  porque el nombre corto es el del tablero, no el de la app.
  - `gymnasia` → `arquitectura-agente/` → <https://gymnasia-sable.vercel.app> (tablero).
  - `gymnasia-web` → `apps/mobile/` → <https://gymnasia.maximofn.com> (export web de la
    app, y **la política de privacidad publicada en `/privacidad` y `/privacy`**).
- Ninguno de los dos se despliega en el push: `vercel project ls` mostraba
  `gymnasia-web` sin actualizar desde hacía 15 días mientras `main` seguía avanzando.
  Mergear la política **no la publica**; hay que lanzar la CLI a mano.
- En un worktree, la raíz no tiene `.vercel/` (está git-ignored), así que desplegar
  sin enlazar puede crear un proyecto equivocado. El proyecto remoto `gymnasia-web`
  ya tiene `apps/mobile` como **Root Directory**: el vínculo y el deploy se hacen
  desde la raíz del repositorio, no desde `apps/mobile/`. Enlazar primero, siempre:
  ```bash
  npm exec --yes -- vercel@latest link --yes --project gymnasia-web --cwd .
  npm exec --yes -- vercel@latest deploy --prod --yes --cwd .
  ```
  La salida debe decir `Deploying gymnasia-web` y aliar `gymnasia.maximofn.com`. Si dice
  `Created`, detente: está creando otro proyecto.
- Si se enlaza dentro de `apps/mobile/`, Vercel sube esa carpeta como raíz y luego
  intenta aplicar otra vez el Root Directory remoto. El build falla con
  `The specified Root Directory "apps/mobile" does not exist`; no se corrige
  reintentando, sino volviendo a enlazar y desplegar desde la raíz como arriba.
- Verificar después, con `curl` y no con Playwright (no tiene salida a internet en el
  sandbox del agente):
  ```bash
  curl -sS -o /dev/null -w '%{http_code}\n' https://gymnasia.maximofn.com/privacidad
  curl -sS https://gymnasia.maximofn.com/privacidad | grep -o 'gymnasia-policy-digest" content="[^"]*"'
  ```
  El digest debe coincidir con `PRIVACY_POLICY_DIGESTS` de
  `apps/mobile/agent/generated/legalCopy.generated.ts`. Si no coincide, lo publicado no
  es lo que se revisó.

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

### Un worktree sin vínculo de Vercel puede crear otro proyecto al desplegar el tablero
- Gotcha: `arquitectura-agente/.vercel/project.json` está ignorado por Git. Un
  worktree nuevo no hereda el vínculo al proyecto `gymnasia`; ejecutar directamente
  `vercel deploy --cwd arquitectura-agente` hace que la CLI busque o cree un proyecto
  con el nombre del directorio. El síntoma es `Searching for existing projects`,
  seguido de `Created .../arquitectura-agente`, y un alias distinto de
  `gymnasia-sable.vercel.app`.
- Fix: antes del deploy, ejecutar
  `npm exec --yes -- vercel@latest link --yes --project gymnasia --cwd arquitectura-agente`
  y verificar que la salida diga `Deploying gymnasia` y termine con el alias de
  producción esperado.

### Vercel puede rechazar el deploy aunque `whoami` funcione
- Gotcha: la sesión general de la CLI puede seguir siendo válida y `vercel whoami`
  devolver `maximofn`, mientras `vercel deploy` falla inmediatamente con
  `Not authorized`. El problema es el token OIDC local del vínculo con el
  proyecto, no necesariamente el login global; repetir el deploy no lo renueva.
- Fix: ejecutar
  `npm exec --yes -- vercel@latest link --yes --project gymnasia --cwd arquitectura-agente`.
  Debe enlazar el proyecto existente y descargar un token OIDC nuevo. Si muestra
  `Created`, detenerse para no crear otro proyecto. Después repetir el deploy.

### `actions/checkout` falla aunque `submodules: false` por gitlinks huérfanos
- Gotcha: `.claude/worktrees/*` contiene entradas gitlink (`mode 160000`) heredadas,
  pero el repositorio no tiene `.gitmodules`. `actions/checkout` ejecuta
  `git submodule foreach` durante la limpieza de credenciales incluso con
  `submodules: false`, y el job termina con `No url found for submodule path`.
- Fix: los workflows del repositorio público hacen `git init` + `git fetch` del
  ref exacto + `git checkout --detach FETCH_HEAD`, sin recorrer submódulos. La
  plantilla del repositorio privado puede usar `actions/checkout` porque no
  contiene esos gitlinks.

### El AAB production puede heredar micrófono y superposición aunque `app.json` no los solicite
- Gotcha: el manifest fusionado del primer AAB production de GYM-197 (ticket para
  preparar la ficha española de Google Play) contenía `RECORD_AUDIO` y
  `SYSTEM_ALERT_WINDOW`, aunque ninguno figuraba en `android.permissions`.
  `RECORD_AUDIO` lo añadía el plugin de `expo-av` por defecto y
  `SYSTEM_ALERT_WINDOW` procedía del manifest debug de React Native. Revisar solo
  `app.json` o los manifests fuente daba un falso negativo.
- Fix: configurar `expo-av` con `microphonePermission: false` y mantener ambos
  permisos en `expo.android.blockedPermissions`. El guard rail los trata como
  prohibidos y la validación final debe hacerse con `bundletool dump manifest`
  sobre el AAB descargado. `MODIFY_AUDIO_SETTINGS` sí se conserva: lo usa
  `Audio.setAudioModeAsync` para los avisos sonoros y no accede al micrófono.
- Entorno local: macOS puede mostrar `/usr/bin/java` aunque sea solo el stub que
  responde que no hay runtime. En esta máquina bundletool funciona con
  `/opt/homebrew/opt/openjdk/bin/java`. Además, `keytool -printcert -jarfile`
  falla bajo el locale español con `MissingFormatArgumentException`; forzar
  `-J-Duser.language=en -J-Duser.country=US` permite imprimir el certificado.

## Post-Modification Workflow
After each modification, create a local commit on a topic branch:
```bash
git add -A && git commit -m '<description>'
git push -u origin <branch>
gh pr create
```
Do not push directly to `main`. Wait for the required checks and merge the pull
request manually. If it touches build-triggering files under `apps/mobile/**`,
ask for explicit confirmation before merging because Expo quota is limited.

Un push a `main` **solo** dispara el build de APK si toca `apps/mobile/**`
(excluyendo `apps/mobile/scripts/**` y los `.md`). Ver el filtro de rutas en
"Commit & Pull Request Guidelines". Un push que sí entre en el filtro gasta build;
el resto, no. La cuota de Expo es finita aunque el plan sea de pago, y sobre todo
las builds se ejecutan de una en una: ver "Una build parada casi nunca es la cola
de Expo" en el Solved Problems Log.

The APK workflow changes `apps/mobile/app.json` only inside the build workspace;
the GitHub tag and Release persist the published version. It must never commit a
version bump directly to `main`.

<!-- OPENWIKI:START -->

## OpenWiki

This repository has a generated `openwiki/` evidence index. It is optional just-in-time context, not required startup reading.

- Treat source code and tests as authoritative. A brief's unknowns and review items are verification gaps, not automatic requirements.
- Prefer the narrowest quiet validation that proves the changed behavior. Preserve complete failure output.

The scheduled OpenWiki GitHub Actions workflow refreshes the repository wiki. Do not hand-edit generated OpenWiki pages unless explicitly asked; prefer updating source code/docs and letting OpenWiki regenerate.

<!-- OPENWIKI:END -->
