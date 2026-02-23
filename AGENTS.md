# Repository Guidelines

## Project Structure & Module Organization
This repo is an npm workspace monorepo.
- `apps/api`: FastAPI backend (`app/routers`, `app/services`, `alembic/versions`).
- `apps/web`: Next.js App Router frontend (`app/**/page.tsx`, `lib/*.ts`).
- `apps/mobile`: Expo React Native app (`App.tsx`, `theme.ts`).
- `packages/shared`: shared TypeScript tokens/types (`src/design-tokens.ts`).
- `docs`: product, backend, and design references.
- `supabase/migrations`: SQL migrations for Supabase environments.

Keep feature changes aligned across API + web/mobile when contracts change.

## Current Delivery Focus
- Since 2026-02-22, prioritize `apps/mobile` as the primary surface.
- New product features should work fully local-first on mobile unless backend work is explicitly requested.
- Do not introduce mandatory Supabase/backend dependencies for the core mobile flow by default.

## Design System Source Of Truth
- The system design reference is the attached `[Image #1]` in this conversation.
- Every UI/UX change must follow that system design (colors, components, spacing, hierarchy, and visual style) unless the user explicitly requests an exception.
- Before closing any UI change, verify it is consistent with `[Image #1]`.

## Build, Test, and Development Commands
Run from repo root unless noted.
- `npm install`: install workspace dependencies.
- `npm run dev:web`: start Next.js on `apps/web`.
- `npm run dev:mobile`: start Expo dev server.
- `npm run dev:api`: run FastAPI with reload (requires Python deps).
- `npm run build:web`: production web build.
- `npm --workspace apps/web exec tsc --noEmit`: web type-check.
- `npm --workspace apps/mobile exec tsc --noEmit`: mobile type-check.
- `cd apps/api && alembic upgrade head`: apply DB migrations.

API first-time setup: `cd apps/api && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cp .env.example .env`.

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
- Important caveats for this project:
  - SecureStore is not available in browser with the same guarantees as native.
  - Direct provider chat from browser may hit CORS/provider restrictions.

## Coding Style & Naming Conventions
- TypeScript is `strict` in web/mobile; prefer explicit domain types in `apps/web/lib`.
- Follow existing TS style: 2-space indentation, semicolons, double quotes.
- React components/types: `PascalCase`; functions/variables: `camelCase`; route folders: lowercase.
- Python: PEP 8, 4-space indentation, type hints, snake_case modules.
- Reuse shared tokens from `packages/shared` before introducing new constants.
- No repo-wide ESLint/Prettier/Ruff config is committed yet; keep diffs consistent with surrounding code.

## Testing Guidelines
Automated unit/integration suites are not yet established. Minimum validation for PRs:
- web build + type-check,
- mobile type-check,
- API smoke check (`GET /health`) after starting `uvicorn`.

When adding non-trivial logic, include tests in the same PR when possible (e.g., `apps/api/tests/test_<feature>.py`), or document manual verification steps explicitly.

## Commit & Pull Request Guidelines
History follows mostly Conventional Commits: `feat(scope): ...`, `fix(scope): ...`, `chore(scope): ...`, `docs: ...`.
- Keep commit subjects imperative and scoped (e.g., `fix(mobile): pin Metro module resolution for monorepo`).
- Keep PRs focused by app/module.
- PR description should include: summary, impacted paths, migration/env changes, commands executed, and screenshots for UI updates.

## Security & Configuration Tips
- Never commit secrets; use `apps/api/.env.example` as template.
- Validate `DATABASE_URL`, `JWT_SECRET`, `APP_ENCRYPTION_KEY`, and client API base URLs before running locally.

## Agent Maintenance Rule
- Whenever a problem is solved, document it in `AGENTS.md` with failure, root cause, and exact fix steps/commands.

## Solved Problems Log
### 2026-02-23 - Diet foods now support edit/delete via three-dot action menu
- Failure:
  Foods already added in `Dieta` could not be edited or removed from the meal cards.
- Root cause:
  Food rows only rendered static nutrition text and kcal value, without per-item actions.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` meal item rows:
     - added right-side `more-vertical` (three-dot) action trigger per food item.
     - added contextual menu with `Editar` and `Eliminar`.
  2. Added edit/delete logic in `apps/mobile/App.tsx`:
     - `startEditDietItem(...)` pre-fills inline editor with selected item values.
     - `addMeal()` now updates existing item when edit mode is active.
     - `deleteDietItem(...)` removes selected item from its meal.
  3. Updated inline editor controls:
     - save button text switches to `Guardar cambios` when editing an existing item.
     - cancel resets edit state and clears temporary inputs.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Estimator JSON now includes dish name and auto-fills title field
- Failure:
  `Devuelve json` responses only included nutrition metrics and did not include the dish name, so the food title field could not be reliably auto-filled from model output.
- Root cause:
  Estimator system prompt and JSON parser contract only required `calories_kcal`, `protein_g`, `carbs_g`, and `fat_g`.
- Exact fix steps/commands:
  1. Updated estimator system prompt in `apps/mobile/App.tsx`:
     - JSON key contract now requires:
       `dish_name`, `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`.
  2. Updated JSON parser in `apps/mobile/App.tsx`:
     - parser now requires non-empty `dish_name` in addition to nutrition keys.
  3. Updated meal auto-fill flow in `apps/mobile/App.tsx`:
     - `Añadir alimento` from estimator now sets meal title from `dish_name`.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Estimator `Añadir alimento` now auto-fills meal form without showing raw JSON
- Failure:
  Pressing estimator `Añadir alimento` showed model JSON in chat instead of applying nutrition values to the inline meal form.
- Root cause:
  The action reused generic chat send flow (`Devuelve json`) and rendered assistant output as a normal message bubble.
- Exact fix steps/commands:
  1. Added JSON parser utility in `apps/mobile/App.tsx`:
     - parses strict nutrition payload keys: `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`.
     - supports fenced payload fallback extraction.
  2. Added dedicated action flow `addFoodFromEstimatorJSON()` in `apps/mobile/App.tsx`:
     - requests model with `Devuelve json` in-memory.
     - does not append model JSON to chat messages.
     - fills inline meal inputs (`kcal`, `P`, `C`, `G`) directly from parsed JSON.
     - auto-fills title with `Alimento estimado IA` when empty.
  3. Updated estimator modal button behavior:
     - `Añadir alimento` now triggers `addFoodFromEstimatorJSON()` instead of generic chat send.
     - stays disabled until first LLM response and while no inline meal editor is open.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Removed duplicated provider mention from estimator chat intro
- Failure:
  Estimator chat intro still displayed provider context (`Proveedor activo: ...`) even though header already shows `Proveedor estimador: ...`.
- Root cause:
  `openFoodEstimatorModal()` initialized assistant message with redundant provider-specific text.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx`:
     - replaced provider intro message with neutral guidance:
       `Sube fotos o describe la comida para comenzar la estimación.`
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Estimator intro copy simplified (removed `Nueva conversación de estimación iniciada`)
- Failure:
  The estimator modal started with verbose assistant copy (`Nueva conversación de estimación iniciada. Proveedor activo: ...`) that was no longer desired.
- Root cause:
  Initial estimator message in `openFoodEstimatorModal()` used hardcoded verbose text.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx`:
     - initial assistant copy now uses only `Proveedor activo: <Proveedor>.`
     - removed prefix `Nueva conversación de estimación iniciada.`
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - API keys now persist in AsyncStorage when SecureStore is unavailable
- Failure:
  In environments without `SecureStore` (e.g., web), provider API keys were lost after reload and users had to re-enter them.
- Root cause:
  Store serialization always stripped `api_key` fields before writing to `AsyncStorage`, while secure key read/write short-circuited when `SecureStore` was unavailable.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` persistence strategy:
     - added `serializeStoreForAsyncStorage(store, secureStoreAvailable)`.
     - when `SecureStore` is available: keeps current secure behavior (keys stripped from AsyncStorage).
     - when `SecureStore` is unavailable: preserves API keys in AsyncStorage fallback.
  2. Applied serializer in both hydration and steady-state persistence flows.
  3. Updated warning copy in `Proveedor IA`:
     - now explicitly states keys are stored in local AsyncStorage without secure encryption.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Food estimator chat now includes gated `Añadir alimento` JSON action
- Failure:
  The estimator chat had no dedicated action to request structured nutrition output for adding food, and prompt behavior for JSON responses was undefined.
- Root cause:
  `apps/mobile/App.tsx` only exposed free-text send in estimator chat and system prompt did not specify a strict JSON-only response path.
- Exact fix steps/commands:
  1. Updated estimator system prompt in `apps/mobile/App.tsx`:
     - when user sends `Devuelve json` or `Devuelve el json`, model must return JSON-only with keys:
       `calories_kcal`, `protein_g`, `carbs_g`, `fat_g`.
  2. Added estimator state gate in `apps/mobile/App.tsx`:
     - `foodEstimatorHasLLMResponse` starts `false` on modal open.
     - switches to `true` only after first successful LLM assistant response.
  3. Added chat action button in estimator modal:
     - new `Añadir alimento` button appears in chat action area.
     - disabled until first LLM response.
     - on press sends fixed message `Devuelve json`.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Inline meal editor now includes `Estimar con IA` between save and cancel actions
- Failure:
  In `Dieta > Añadir alimento` (inline editor), actions only showed `Guardar alimento` and `Cancelar`.
- Root cause:
  The inline action row did not include the AI estimator trigger required by the updated meal-entry workflow.
- Exact fix steps/commands:
  1. Updated inline editor action row in `apps/mobile/App.tsx`:
     - inserted `Estimar con IA` button between `Guardar alimento` and `Cancelar`.
     - wired button to `openFoodEstimatorModal`.
     - adjusted action button widths to `flex: 1` for balanced layout.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Inline `Añadir alimento` macro fields no longer overflow card width
- Failure:
  In `Dieta`, when opening `Añadir alimento` inside a meal card, macro inputs (`P`, `C`, `G`) could exceed the visible width.
- Root cause:
  The inline macro inputs were rendered in a single horizontal row, which overflowed on constrained viewport widths.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` in the inline meal editor:
     - changed macro inputs container from horizontal row to vertical stack.
     - set each macro input to `width: 100%`.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Diet tab layout aligned to design reference with fixed meal categories
- Failure:
  `Dieta` did not match `[Image #1]`: it used a generic form/list flow and allowed arbitrary meal titles instead of the required meal sections.
- Root cause:
  The UI rendered a generic daily progress block plus free-form meal creation (`Título`) and did not enforce the product meal taxonomy.
- Exact fix steps/commands:
  1. Reworked `apps/mobile/App.tsx` diet screen structure to mirror the reference:
     - top nutrition summary card with consumed/target kcal, percent badge, progress bar, and macro mini-bars.
     - meal cards styled as sections (`Desayuno`, `Almuerzo`, `Comida`, `Merienda`, `Cena`) with collapse/expand behavior.
  2. Enforced fixed meal categories in logic:
     - added `DietMealCategory` + ordered category constants.
     - `addMeal()` now appends food items only into those categories.
     - removed free meal-title flow for category creation.
  3. Updated food-add interaction:
     - each meal card now has `Añadir alimento` and inline fields (`alimento`, kcal, P/C/G) for that meal.
  4. Moved `Estimar con IA` entry point to floating camera button in `Dieta` to match visual hierarchy.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Diet tab now includes AI estimator modal with photos, camera and dedicated chat
- Failure:
  The meal form only allowed manual entry and had no AI-assisted flow to estimate calories/macros from food photos or discuss adjustments in a dedicated conversation.
- Root cause:
  `apps/mobile/App.tsx` had no UI/action next to `Guardar comida` for AI estimation, no per-session estimator chat state, and no multimodal provider call path (text + image) for diet estimation.
- Exact fix steps/commands:
  1. Added `Estimar con IA` action in `apps/mobile/App.tsx`:
     - placed next to `Guardar comida` inside `Dieta > Añadir comida local`.
  2. Added estimator modal/screen flow in `apps/mobile/App.tsx`:
     - supports adding photos from gallery and camera.
     - supports removing attached photos and shows count limit.
     - includes dedicated chat panel and input.
     - conversation is reset each time the modal opens (new session per open).
  3. Added provider fallback priority for estimator:
     - default provider order: `Google -> OpenAI -> Anthropic`.
     - resolves first provider with saved API key.
  4. Added dedicated estimator system prompt:
     - instructs LLM to estimate calorías, proteína, carbohidratos, grasas y peso en gramos.
  5. Added multimodal provider call path in `apps/mobile/App.tsx`:
     - OpenAI: chat completions with `image_url` data URLs.
     - Google: Gemini `inline_data` image parts.
     - Anthropic: native messages API with base64 image blocks (web path keeps current proxy constraints).
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Diet macros inputs no longer overflow screen width
- Failure:
  In `Dieta`, the row with `Proteínas / Carbos / Grasas` inputs could overflow horizontally on web preview (`http://localhost:8081/`).
- Root cause:
  The three macro inputs were rendered in a single horizontal row, which could exceed available width on narrower viewports.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` in `Añadir comida local`:
     - changed macro inputs container from horizontal row to vertical stack.
     - set each macro input width to `100%` to ensure full-width fit.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Diet tab now shows daily progress bars for calories and macros
- Failure:
  The `Dieta` tab only showed meals and calories, without daily consumed/remaining/total visibility for calories and each macro.
- Root cause:
  `DietItem` stored only `calories_kcal`, so the app could not compute consumed protein/carbs/fat, and the diet screen had no progress UI for targets.
- Exact fix steps/commands:
  1. Extended diet data model in `apps/mobile/App.tsx`:
     - `DietItem` now includes `protein_g`, `carbs_g`, and `fat_g`.
     - added hydration normalization (`normalizeDietByDate`) to keep compatibility with legacy saved entries.
  2. Updated meal creation flow in `apps/mobile/App.tsx`:
     - `Añadir comida local` now captures calories + proteína + carbos + grasas.
     - `addMeal()` validates non-negative macro inputs and persists them per item.
  3. Added daily diet progress visualization in `apps/mobile/App.tsx`:
     - shows bars for calorías, proteínas, carbohidratos y grasas.
     - each row displays consumed in the bar and `X/Y` on the right (`restante/total`), plus exceeded state when applicable.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Model dropdowns now support text filtering in all providers
- Failure:
  Model selection lists lacked an in-list search box, making it slow to find a model when many entries are returned.
- Root cause:
  Provider settings UI in `apps/mobile/App.tsx` rendered plain model lists for Anthropic/OpenAI and text input for Google, without unified filterable dropdown behavior.
- Exact fix steps/commands:
  1. Added filter inputs for model lists in `apps/mobile/App.tsx`:
     - Anthropic dropdown now includes `Filtrar modelos...` and filters by `id` + `display_name`.
     - OpenAI dropdown now includes `Filtrar modelos...` and filters by `id` + `owned_by`.
     - Google now uses dropdown + refresh + `Filtrar modelos...` with filtered list.
  2. Added Google model discovery in `apps/mobile/App.tsx`:
     - fetches `GET https://generativelanguage.googleapis.com/v1beta/models?key=...`
     - normalizes `models/<id>` to `<id>` and keeps only models supporting `generateContent`.
  3. Added provider-specific filter/dropdown state resets:
     - on API key change, save, selection, delete, and local reset to avoid stale filtered results.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - OpenAI model field replaced with API-driven dropdown (`/v1/models`)
- Failure:
  OpenAI model selection was a manual text input, so users could not pick from the real model list available for their API key.
- Root cause:
  `apps/mobile/App.tsx` only implemented API-driven model discovery/dropdown for Anthropic, and backend proxy endpoints only covered Anthropic models.
- Exact fix steps/commands:
  1. Added OpenAI models proxy in `apps/api`:
     - new endpoint: `POST /chat/providers/openai/models` in `apps/api/app/routers/chat.py`
     - proxies `GET https://api.openai.com/v1/models` with `Authorization: Bearer <api_key>`
     - added request/response schemas in `apps/api/app/schemas.py`.
  2. Updated mobile provider settings in `apps/mobile/App.tsx`:
     - added OpenAI model options loading (direct on native, proxy on web).
     - replaced OpenAI model text input with dropdown + refresh action (same UX pattern as Anthropic).
     - added OpenAI model state cleanup on API key change/delete and save flow.
  3. Updated OpenAI key verification on web:
     - `verifyProviderConnection()` now uses proxy for OpenAI in web context to avoid direct browser CORS issues.
  4. Validated:
     - `python3 -m compileall apps/api/app`
     - `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Provider status copy simplified for severity messages
- Failure:
  Provider status strings included extra wording (`Todo bien`, `Atención media`, `Error grave`) and did not match the product copy requested for connection states.
- Root cause:
  `PROVIDER_STATUS_COPY` in `apps/mobile/App.tsx` still used the previous verbose text set.
- Exact fix steps/commands:
  1. Updated `PROVIDER_STATUS_COPY` in `apps/mobile/App.tsx`:
     - `success` -> `Conexión verificada.`
     - warning messages now use `Atención: ...`
     - fallback error now uses `Error: ...`
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Unsaved provider API keys no longer enable delete and are not persisted on failed validation
- Failure:
  Typing an API key without pressing `Guardar` enabled `Eliminar`, and failed validation attempts could still end up persisting invalid key values.
- Root cause:
  Delete CTA availability considered draft input values, and `saveProviderApiKey()` wrote provider key config before checking validation result.
- Exact fix steps/commands:
  1. Updated delete eligibility in `apps/mobile/App.tsx`:
     - `Eliminar` now depends only on persisted key (`store.keys`), not draft input.
     - modal opener now guards on persisted key only.
  2. Updated save flow in `apps/mobile/App.tsx`:
     - provider key is persisted only when `verifyProviderConnection()` returns `ok`.
     - on failed validation, draft remains local and unsaved.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Provider `Eliminar` button is disabled when no API key exists
- Failure:
  The `Eliminar` button remained interactive even when a provider had no API key, allowing a meaningless delete action.
- Root cause:
  Delete CTA availability was not tied to actual key presence (draft/saved), and modal opener did not guard against empty key state.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` provider card logic:
     - computed `hasAnyProviderApiKey` from draft or persisted key value.
     - set `disabled` on `Eliminar` when no key exists.
     - added disabled visual treatment (muted color/opacity).
  2. Added no-op guard in modal opener:
     - `openDeleteProviderApiKeyModal()` now returns immediately if key is empty.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Provider delete action now uses in-app confirmation modal and clears API key from memory
- Failure:
  Pressing `Eliminar` in provider settings used native `Alert` and did not follow the custom modal UX required by the design reference.
- Root cause:
  `deleteProviderApiKey()` in `apps/mobile/App.tsx` was implemented with `Alert.alert(...)` instead of an in-app modal component.
- Exact fix steps/commands:
  1. Replaced delete flow in `apps/mobile/App.tsx`:
     - added modal state (`providerDeleteModal`) with provider + masked key preview.
     - `Eliminar` now opens a custom overlay modal.
  2. Implemented modal actions:
     - `Sí, eliminar clave` clears API key from in-memory store/draft and updates provider status to disconnected.
     - `Cancelar` closes the modal without changes.
  3. Added modal UI matching `[Image #1]` style:
     - warning icon, title, irreversible action copy, red warning box, masked key row, primary destructive button, and cancel button.
  4. Preserved related cleanup for Anthropic state:
     - closes model dropdown and clears loaded model options/messages after deletion.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Anthropic model field replaced with API-driven dropdown in mobile settings
- Failure:
  Anthropic model was a free text input (`claude-3-5-sonnet-latest`) and users had to type model IDs manually without seeing available models from their API key.
- Root cause:
  `apps/mobile/App.tsx` had no model discovery flow for Anthropic and no endpoint to proxy `/v1/models` for web context.
- Exact fix steps/commands:
  1. Added Anthropic models proxy endpoint in `apps/api/app/routers/chat.py`:
     - `POST /chat/providers/anthropic/models`
     - forwards request to `GET https://api.anthropic.com/v1/models` with `x-api-key` + `anthropic-version`.
  2. Added API schemas in `apps/api/app/schemas.py`:
     - `AnthropicProxyModelsRequest`
     - `AnthropicProxyModelItem`
     - `AnthropicProxyModelsResponse`
  3. Reworked Anthropic model UI in `apps/mobile/App.tsx`:
     - replaced text input with dropdown selector for active Anthropic provider.
     - dropdown fetches and shows model list (id + display name) from API.
     - added `Actualizar modelos` action and loading/error handling.
     - selecting a model updates draft config and marks provider settings as pending save.
  4. Preserved platform behavior:
     - web uses backend proxy endpoint.
     - native uses direct Anthropic API call.
  5. Validated backend syntax:
     `python3 -m compileall apps/api/app`
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Provider status UI now uses severity levels (green/yellow/red) with unified copy
- Failure:
  Provider connection detail color depended on specific text matches (e.g. `Failed to fetch`), and warning cases like `API key verificada. Modelo no disponible...` did not have a stable medium-severity visual treatment.
- Root cause:
  `ProviderConnectionStatus` stored only `state` + `detail`; severity was inferred from string contents in UI instead of explicit semantic status.
- Exact fix steps/commands:
  1. Refactored provider status model in `apps/mobile/App.tsx`:
     - added `severity` (`success`, `warning`, `error`, `info`) to `ProviderConnectionStatus`.
     - extended `ProviderConnectionCheckResult` with severity.
  2. Unified status copy for provider panel:
     - success: `Todo bien: conexión verificada.`
     - medium/warning: `Atención media: ...`
     - severe/error: `Error grave: ...`
  3. Applied semantic color mapping in UI:
     - success -> green
     - warning -> yellow
     - error -> red
     - removed text-fragile color checks based on literal message content.
  4. Updated Anthropic verify warning path:
     - `modelo no disponible` now remains connected with warning severity and yellow detail text.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `npm run dev:api` now uses project virtualenv instead of global uvicorn
- Failure:
  Running `npm run dev:api` crashed with `ModuleNotFoundError: No module named 'fastapi'`.
- Root cause:
  Root script `dev:api` invoked global `uvicorn`, which used system Python instead of `apps/api/.venv` where backend dependencies are installed.
- Exact fix steps/commands:
  1. Updated root script in `package.json`:
     - `dev:api` from `cd apps/api && uvicorn app.main:app --reload`
     - to `cd apps/api && .venv/bin/uvicorn app.main:app --reload`
  2. Confirmed app import resolves FastAPI in venv:
     `cd apps/api && .venv/bin/python -c "from app.main import app; print(app.title)"`

### 2026-02-23 - API CORS defaults expanded for Expo web origin on port 8081
- Failure:
  Anthropic web proxy calls could still fail from browser due to backend CORS if Expo web served from `http://localhost:8081`.
- Root cause:
  Default `CORS_ORIGINS` only included ports `3000` and `19006`, missing Expo web origin `8081`.
- Exact fix steps/commands:
  1. Updated API settings default in `apps/api/app/config.py`:
     - added `http://localhost:8081` and `http://127.0.0.1:8081` to `cors_origins`.
  2. Updated sample env in `apps/api/.env.example` with the same origins.
  3. Validated backend syntax:
     `python3 -m compileall apps/api/app`
  4. Re-validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Anthropic works on web via backend proxy (no direct browser CORS call)
- Failure:
  In web preview, saving or using Anthropic from `apps/mobile` failed with `Failed to fetch` even when the API key was valid in terminal `curl`.
- Root cause:
  Browser execution path called Anthropic directly from frontend, which is blocked by CORS/network policy in this context.
- Exact fix steps/commands:
  1. Added API proxy endpoints in `apps/api/app/routers/chat.py`:
     - `POST /chat/providers/anthropic/verify`
     - `POST /chat/providers/anthropic/messages`
     - both forward requests to Anthropic with required headers (`x-api-key`, `anthropic-version`, `content-type`) and return parsed provider errors.
  2. Added request/response schemas in `apps/api/app/schemas.py` for Anthropic proxy payloads.
  3. Updated `apps/mobile/App.tsx`:
     - in `web` + Anthropic, use backend proxy endpoints instead of direct provider calls for both key verification and chat messages.
     - resolve proxy base URL from `EXPO_PUBLIC_API_BASE_URL` with fallback `http://127.0.0.1:8000`.
     - show actionable error if proxy API is unreachable.
     - updated initial chat helper copy to mention Anthropic web proxy behavior.
  4. Validated backend syntax:
     `python3 -m compileall apps/api/app`
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Anthropic key check now mirrors `curl /v1/messages` and surfaces web CORS cause
- Failure:
  Users could validate Anthropic keys via terminal `curl` to `/v1/messages`, but app-side save sometimes failed with `Failed to fetch`, creating confusion about whether the API key was invalid.
- Root cause:
  Anthropic provider verification in-app used a different endpoint flow and network-level failures in browser context surfaced as generic fetch errors.
- Exact fix steps/commands:
  1. Updated Anthropic verification in `apps/mobile/App.tsx`:
     - use `POST https://api.anthropic.com/v1/messages` with minimal payload (`max_tokens: 1`) to validate the key using the same path as production chat calls.
     - keep `x-api-key`, `anthropic-version`, and `Content-Type` headers.
  2. Added clearer web failure diagnosis:
     - if provider is Anthropic, platform is web, and error is `Failed to fetch`, show explicit message about likely browser CORS blocking direct provider calls and suggest Expo Go/proxy backend.
  3. Preserved UX behavior:
     - if endpoint returns `404` (model not available), keep provider as connected with warning detail about model availability.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Provider status now shows `Failed to fetch` in red
- Failure:
  When provider connection checks failed with `Failed to fetch`, the detail text was rendered in neutral gray, reducing error visibility.
- Root cause:
  The color rule for provider connection detail only treated `Sin API key guardada` as an error-styled message.
- Exact fix steps/commands:
  1. Updated provider detail color logic in `apps/mobile/App.tsx`:
     - treat `connectionStatus.detail` containing `failed to fetch` (case-insensitive) as error state.
     - keep `Sin API key guardada` as error state.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Anthropic API key verification aligned with official models endpoints
- Failure:
  Saving an Anthropic API key did not consistently communicate a reliable connected/disconnected state tied to Anthropic's documented auth check flow.
- Root cause:
  Provider verification used a basic Anthropic models request without explicit model-availability feedback and the UI always forced a generic connected detail string, losing verification context.
- Exact fix steps/commands:
  1. Updated Anthropic verification flow in `apps/mobile/App.tsx`:
     - verify key with `GET https://api.anthropic.com/v1/models` using `x-api-key`, `anthropic-version`, and `Content-Type`.
     - added a second check to `GET /v1/models/{model}` to confirm configured model availability.
  2. Improved save status detail handling:
     - connected state now shows `check.message` instead of a fixed string, so Anthropic verification context is visible after save.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Removed seeded initial data (empty first-run state)
- Failure:
  The app started with preloaded demo values (calories, weight, routines, etc.), but product requirement is an empty initial state.
- Root cause:
  `createInitialStore()` in `apps/mobile/App.tsx` generated seeded templates/diet/measurements/chat content, and storage keys reused previously persisted data.
- Exact fix steps/commands:
  1. Updated initial local store to start empty:
     - `templates: []`
     - `dietByDate: {}`
     - `measurements: []`
     - chat initialized with one empty thread and no messages
  2. Bumped AsyncStorage key to force clean state:
     - `STORAGE_KEY` -> `gymnasia.mobile.local.v3`
  3. Bumped SecureStore prefix to avoid loading old secure values:
     - `SECURE_STORE_API_KEY_PREFIX` -> `gymnasia.mobile.v3.provider.api_key`
  4. Added legacy cleanup on hydrate:
     - remove AsyncStorage keys: `gymnasia.mobile.local.v1`, `gymnasia.mobile.local.v2`
     - remove SecureStore prefixes: `gymnasia.mobile.provider.api_key.*`, `gymnasia.mobile.v2.provider.api_key.*`
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Reusable skill created for browser execution workflow
- Failure:
  Browser execution guidance existed in notes, but there was no dedicated reusable skill trigger for running/troubleshooting `apps/mobile` in web mode.
- Root cause:
  No skill encapsulated the canonical `expo start --web` flow, required web dependencies, and Metro web troubleshooting steps.
- Exact fix steps/commands:
  1. Initialized global skill:
     `uv run --with pyyaml /Users/macm1/.codex/skills/.system/skill-creator/scripts/init_skill.py mobile-web-runbook --path /Users/macm1/.agents/skills --interface display_name=\"Mobile Web Runbook\" --interface short_description=\"Run and troubleshoot Expo web preview for apps/mobile\" --interface default_prompt=\"Usa \\$mobile-web-runbook para ejecutar apps/mobile en navegador y resolver errores de arranque web\"`
  2. Authored final instructions in:
     `/Users/macm1/.agents/skills/mobile-web-runbook/SKILL.md`
  3. Regenerated UI metadata:
     `uv run --with pyyaml /Users/macm1/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py /Users/macm1/.agents/skills/mobile-web-runbook --interface display_name=\"Mobile Web Runbook\" --interface short_description=\"Run and troubleshoot Expo web preview for apps/mobile\" --interface default_prompt=\"Usa \\$mobile-web-runbook para ejecutar apps/mobile en navegador y resolver errores de arranque web\"`
  4. Validated skill structure:
     `uv run --with pyyaml /Users/macm1/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/macm1/.agents/skills/mobile-web-runbook`

### 2026-02-22 - Web preview setup fixed for `apps/mobile`
- Failure:
  Running `npm --workspace apps/mobile run web` initially failed because required web dependencies were missing.
- Root cause:
  `react-dom`, `react-native-web`, and `@expo/metro-runtime` were not installed in `apps/mobile`.
- Exact fix steps/commands:
  1. Installed Expo SDK-compatible web packages:
     `npm --workspace apps/mobile exec expo install react-dom react-native-web @expo/metro-runtime`
  2. Verified web bundle compilation:
     `cd apps/mobile && npx expo export --platform web --dev`
  3. Note:
     In restricted/sandboxed environments, `expo start --web` may fail to bind local ports; use `expo export` as a compilation check.

### 2026-02-22 - Reusable skill created for mobile execution workflow
- Failure:
  Mobile execution and Expo Go troubleshooting steps were repeated ad-hoc in conversation without a reusable skill trigger.
- Root cause:
  There was no dedicated skill encapsulating the canonical commands, checks, and fixes for running `apps/mobile` on physical devices.
- Exact fix steps/commands:
  1. Created global skill folder:
     `/Users/macm1/.agents/skills/mobile-expo-runbook`
  2. Added skill instructions:
     `/Users/macm1/.agents/skills/mobile-expo-runbook/SKILL.md`
  3. Generated UI metadata:
     `uv run --with pyyaml /Users/macm1/.codex/skills/.system/skill-creator/scripts/generate_openai_yaml.py /Users/macm1/.agents/skills/mobile-expo-runbook --interface display_name=\"Mobile Expo Runbook\" --interface short_description=\"Run and troubleshoot Expo Go mobile execution for this repo\" --interface default_prompt=\"Ejecuta la app en móvil con Expo Go, valida tunnel y corrige errores de arranque\"`
  4. Validated skill format:
     `uv run --with pyyaml /Users/macm1/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/macm1/.agents/skills/mobile-expo-runbook`

### 2026-02-22 - Tunnel mode not applied when starting mobile from root alias
- Failure:
  Running `npm run dev:mobile -- --tunnel --clear` sometimes started Metro in LAN mode (`exp://192.168.x.x:8081`) instead of tunnel, causing device connectivity issues and `Failed to download remote update`.
- Root cause:
  In this workspace command chain, tunnel flags were not always propagated as expected to the final `expo start` process.
- Exact fix steps/commands:
  1. Start mobile directly at workspace level with explicit argument forwarding:
     `npm --workspace apps/mobile run start -- --tunnel --clear`
  2. Verify startup output includes:
     - `Tunnel connected.`
     - `Tunnel ready.`
     - `exp://...exp.direct`
  3. Scan QR only after these conditions are met.

### 2026-02-22 - Metro 500 fixed (`Failed to download remote update`)
- Failure:
  Expo Go loaded the project but then showed `The development server returned response error code 500`.
- Root cause:
  Missing Babel preset dependency after SDK upgrade: `babel-preset-expo` was not installed, so Metro failed to compile `index.js` and returned HTTP 500.
- Exact fix steps/commands:
  1. Installed missing preset with Expo-compatible version:
     `npm --workspace apps/mobile exec expo install babel-preset-expo`
  2. Verified Metro can bundle Android entry successfully:
     `cd apps/mobile && npx expo export --platform android --dev`
  3. Re-validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Expo Go SDK mismatch fixed by upgrading mobile app to SDK 54
- Failure:
  Scanning the QR in Expo Go failed with: project uses SDK 51 while installed Expo Go targets SDK 54.
- Root cause:
  `apps/mobile` was still pinned to Expo SDK 51 dependency set, incompatible with current Expo Go runtime.
- Exact fix steps/commands:
  1. Upgraded Expo package:
     `npm --workspace apps/mobile exec expo install expo@^54.0.0`
  2. Aligned SDK-native dependencies:
     `npm --workspace apps/mobile exec expo install react react-native expo-status-bar expo-secure-store @react-native-async-storage/async-storage`
  3. Fixed TypeScript toolchain versions for SDK 54:
     - Updated `apps/mobile/package.json`:
       - `devDependencies.typescript` -> `~5.9.2`
       - `devDependencies.@types/react` -> `~19.1.10`
       - removed duplicated `typescript` / `@types/react` from `dependencies`
  4. Installed updated lockfile:
     `npm install --workspace apps/mobile`
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Provider API keys moved to secure device storage
- Failure:
  Provider API keys were persisted in `AsyncStorage`, which is not appropriate for sensitive secrets.
- Root cause:
  `apps/mobile/App.tsx` serialized the full `store.keys` object (including `api_key`) into `STORAGE_KEY`.
- Exact fix steps/commands:
  1. Added `expo-secure-store` and integrated it in `apps/mobile/App.tsx`.
  2. Implemented secure key read/write helpers per provider and availability checks (`SecureStore.isAvailableAsync()`).
  3. Added migration logic on app hydrate: load keys from legacy state, persist them into SecureStore, then sanitize AsyncStorage payload.
  4. Updated steady-state persistence: non-sensitive state -> AsyncStorage, API keys -> SecureStore only.
  5. Updated settings copy/UI to reflect secure storage status and SecureStore availability.
  6. Installed dependency:
     `npm install --workspace apps/mobile`
  7. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Chat switched from local mock reply to direct provider API calls
- Failure:
  Chat responses were generated locally, but product requirement is that chat must call the AI provider API directly from mobile.
- Root cause:
  `apps/mobile/App.tsx` used `buildLocalCoachReply()` instead of network calls, and provider settings did not store API key/model for real BYOK requests.
- Exact fix steps/commands:
  1. Replaced local chat reply path with `callProviderChatAPI()` in `apps/mobile/App.tsx` for direct calls to OpenAI, Anthropic, and Google AI APIs.
  2. Updated local provider config model to persist `api_key`, `model`, and single active provider selection in AsyncStorage-backed state.
  3. Updated Settings UI in `apps/mobile/App.tsx` to configure active provider, API key, and model.
  4. Added error handling that surfaces provider API failures in UI and chat thread.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Mobile app now runs fully local (no backend/Supabase dependency)
- Failure:
  The mobile app required backend endpoints (`/auth`, `/workouts`, `/diet`, `/measurements`, `/chat`) and remote API environment config (`EXPO_PUBLIC_API_BASE_URL`), so it could not run as a self-contained local-only app.
- Root cause:
  `apps/mobile/App.tsx` used a network-first architecture with `fetch` calls and token-based login; data source was API/Supabase instead of device-local persistence.
- Exact fix steps/commands:
  1. Replaced remote data flow in `apps/mobile/App.tsx` with local state + AsyncStorage persistence (`@react-native-async-storage/async-storage`) including local seed data and local chat replies.
  2. Added AsyncStorage dependency in `apps/mobile/package.json`.
  3. Removed remote API env vars from `apps/mobile/eas.json`.
  4. Installed dependencies:
     `npm install --workspace apps/mobile`
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - npm audit warnings triaged for workspace install
- Failure:
  Running `npm install` at repo root reports `34 vulnerabilities (1 low, 32 high, 1 critical)`.
- Root cause:
  Vulnerabilities come from transitive dependencies in the Expo/React Native mobile toolchain (`expo@51.x`, `react-native@0.74.5`) such as `fast-xml-parser`, `minimatch`, `tar`, and `send`.  
  `npm audit fix --force` requires major upgrades (`react-native@0.84.0`) and currently conflicts with root overrides (`EOVERRIDE`).
- Exact fix steps/commands:
  1. Collected full audit details:
     `npm audit --json`
  2. Tried safe auto-fix (no major bumps):
     `npm audit fix`
  3. Verified unresolved findings and proposed forced upgrades:
     `npm audit`
  4. Confirmed source packages in dependency tree:
     `npm explain fast-xml-parser`
     `npm explain minimatch`
     `npm explain tar`
     `npm explain send`
  5. Scoped risk by workspace:
     `npm audit --workspace apps/mobile --omit=dev`
     `npm audit --workspace apps/web --omit=dev` (web returned 0 vulnerabilities)
  6. Simulated forced fix to confirm upgrade path/blocker:
     `npm audit fix --force --dry-run` (fails with `EOVERRIDE` due pinned `react-native` override)
  7. Current safe resolution:
     keep current mobile stack without `--force` and plan a dedicated Expo/RN major upgrade branch to reduce audit findings.

### 2026-02-22 - `Train` empty state aligned to design system `[Image #1]`
- Failure:
  The initial `Train` screen (with zero routines) did not match the required UI from `[Image #1]` (title, search bar, category chips, centered empty-state block, and CTA hierarchy).
- Root cause:
  `apps/mobile/App.tsx` rendered a generic templates list without a dedicated empty-state composition for the no-routines scenario.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` training header behavior:
     - screen title now shows `Mis Rutinas` when `tab === "training"`.
  2. Added training discovery controls:
     - search input (`Buscar rutinas...`)
     - chips: `Todos`, `Fuerza`, `Cardio`, `Flexibilidad`
     - lightweight filter logic (`trainingSearch`, `trainingFilter`, `filteredTrainingTemplates`)
  3. Rebuilt empty-state UI to follow `[Image #1]`:
     - centered icon container with list glyph
     - primary message `Sin rutinas aún`
     - supporting copy `Crea tu primera rutina personalizada y empieza a entrenar`
     - bright primary CTA `+ CREAR RUTINA`
  4. Added CTA action:
     - `createTrainingTemplate()` creates a local routine template and exits empty state.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - `CREAR RUTINA` now opens exercise/sets editor
- Failure:
  Tapping `CREAR RUTINA` created a routine but did not transition into a screen to add exercises and series.
- Root cause:
  `createTrainingTemplate()` only appended to `store.templates`; there was no selected-routine editor state in `Train`.
- Exact fix steps/commands:
  1. Added selected-routine editor state in `apps/mobile/App.tsx`:
     - `activeTrainingTemplateId`
     - `exerciseNameInput`
     - `exerciseSetsInput`
  2. Updated routine creation flow:
     - `createTrainingTemplate()` now creates the routine and immediately calls `openTrainingTemplate(templateId)`.
  3. Implemented training editor actions:
     - `openTrainingTemplate()`
     - `closeTrainingTemplateEditor()`
     - `addExerciseToActiveTemplate()` with series parsing/validation (`parseTrainingSets`)
     - `removeExerciseFromActiveTemplate()`
  4. Updated `Train` UI behavior:
     - if a routine is selected, render editor panel for adding exercises + sets
     - existing routine cards are now pressable and open editor (`EDITAR RUTINA`)
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - `Train` list state redesigned to match `[Image #1]` (with saved routines)
- Failure:
  With routines already saved, the `Train` tab list still looked generic and did not match the target design system (count badge, rich cards, context menu, and floating CTA).
- Root cause:
  The non-empty `training` branch in `apps/mobile/App.tsx` rendered simple cards without the visual hierarchy and interactions shown in `[Image #1]`.
- Exact fix steps/commands:
  1. Enhanced training list presentation in `apps/mobile/App.tsx`:
     - header count pill (`N rutinas`) on non-empty list view
     - horizontal category chips row
     - richer routine cards (category accent, icon tile, metadata line, menu trigger)
  2. Added routine card context menu actions:
     - `Editar rutina`
     - `Clonar rutina`
     - `Mover posición` (move up)
     - `Eliminar rutina`
  3. Added supporting handlers:
     - `cloneTrainingTemplate()`
     - `moveTrainingTemplateUp()`
     - `deleteTrainingTemplate()`
     - plus helper mappers for category styling and duration (`trainingCategoryMeta`, `inferTemplateDurationMinutes`)
  4. Added floating primary CTA on non-empty list:
     - `+ Nueva rutina`
  5. Preserved existing behaviors:
     - empty state from `[Image #1]`
     - direct transition to exercise/sets editor after creating a routine
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - New routine flow now opens a detailed editor matching `[Image #1]`
- Failure:
  After tapping `Crear nueva rutina`, the app opened a basic editor and did not resemble the expected detailed routine editor screen from `[Image #1]`.
- Root cause:
  The selected-routine UI in `apps/mobile/App.tsx` lacked the target structure: top action bar (`Rutinas` + `Guardar`), workout metadata strip, expandable exercise blocks with set table, exercise context menu, and bottom save CTA.
- Exact fix steps/commands:
  1. Updated routine model for richer editor data:
     - exercise fields now support optional metadata (`muscle`, `load_kg`, `rest_seconds`).
  2. Added training editor helpers:
     - category/name inference for routine creation
     - default exercise generation per category (`defaultExercisesForCategory`)
     - duration/series calculations for metadata display.
  3. Changed `createTrainingTemplate()` behavior:
     - creates a routine preloaded with structured exercises and opens editor immediately.
  4. Rebuilt selected-routine view to match reference layout:
     - top bar with back (`← Rutinas`) and primary `Guardar`
     - large routine title + metadata row (`categoría`, ejercicios, duración, series)
     - exercise cards with index badge, expandable details, set table (`#`, `REPS`, `KG`, `DESC`)
     - per-exercise actions menu (`Editar`, `Clonar`, `Mover posición`, `Eliminar`)
     - bottom primary button `Guardar cambios`.
  5. Added exercise-level handlers:
     - clone/move/delete exercise inside active routine
     - add series row to expanded exercise.
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - New routine now starts empty and includes explicit `Agregar ejercicio` action
- Failure:
  Creating a new routine opened the editor with preloaded exercises, and there was no clear primary action to add the first exercise manually.
- Root cause:
  `createTrainingTemplate()` used category-based seeded exercises; editor relied on existing cards without a dedicated top-level `Agregar ejercicio` CTA.
- Exact fix steps/commands:
  1. Updated `createTrainingTemplate()` in `apps/mobile/App.tsx`:
     - new routines now initialize with `exercises: []`.
  2. Added explicit editor action:
     - new handler `addExerciseToActiveTemplate()` to append a new exercise block to the active routine.
  3. Added UI button in routine editor:
     - prominent `+ Agregar ejercicio` CTA above exercise cards.
  4. Added empty-editor placeholder:
     - if there are no exercises, show guidance text prompting the user to add the first one.
  5. Removed now-unused seeded helper:
     - deleted `defaultExercisesForCategory()` to avoid accidental prefilling.
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Routine editor fields are now fully editable (name, duration, exercise name, reps/kg/rest)
- Failure:
  In the routine editor, users could not edit the routine name, duration was effectively fixed by default computation, exercise names were not editable, and series values (`reps`, `kg`, `descanso`) were read-only.
- Root cause:
  The editor UI rendered static `Text` values for those fields and lacked update handlers for nested routine/exercise/series state.
- Exact fix steps/commands:
  1. Extended workout model in `apps/mobile/App.tsx`:
     - added optional template field `duration_minutes`
     - added per-series editable structure (`series`) on exercises.
  2. Added normalization/migration logic in `normalizeStore()`:
     - legacy `sets`/`load_kg`/`rest_seconds` are converted into editable `series`.
  3. Added editor update handlers:
     - `updateActiveTrainingName()`
     - `updateActiveTrainingDuration()`
     - `updateExerciseNameInActiveTemplate()`
     - `updateExerciseSeriesFieldInActiveTemplate()`
  4. Updated editor UI to use editable inputs:
     - routine title is now `TextInput`
     - duration minutes is now `TextInput`
     - exercise name is now `TextInput`
     - each series row now has editable inputs for `reps`, `kg`, and `descanso (s)`.
  5. Updated series operations to work with new model:
     - add/clone series/exercise now preserve and generate series IDs
     - legacy `sets` are kept synchronized from series for compatibility.
  6. Updated duration behavior:
     - removed fixed empty-duration fallback (`25 min`), showing dynamic/explicit duration instead.
  7. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Duration now uses per-series timing and routine category is editable
- Failure:
  Duration estimate did not reflect series/rest data (e.g. 4 series with 1 minute rest), and users could not edit routine type (`Fuerza`, `Cardio`, `Flexibilidad`) from the routine editor.
- Root cause:
  Duration fallback formula was still based on static set-count heuristics, and routine category was inferred from the name only without an editable field.
- Exact fix steps/commands:
  1. Extended routine model in `apps/mobile/App.tsx`:
     - added optional `category` on `WorkoutTemplate`.
  2. Added explicit category resolver/parsing helpers:
     - `resolveTrainingCategory()` uses persisted category and falls back to name inference.
  3. Updated duration computation:
     - `inferTemplateDurationMinutes()` now computes total from each series as:
       - `30s` active time per series, plus
       - parsed rest (`descanso`) per series.
  4. Added rest parser with user-friendly inputs:
     - supports `mm:ss`, `Xm`, `Xs`, and numeric values (`1` interpreted as 1 minute; values >10 treated as seconds).
  5. Added editable category controls in editor:
     - chips for `Fuerza`, `Cardio`, `Flexibilidad` that update routine category directly.
  6. Wired category into flows:
     - filter/list/editor now read category from routine state instead of name-only inference.
     - new routines persist selected category at creation time.
  7. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Routine category label standardized to `Flexibilidad`
- Failure:
  In the routine editor chips, the category label was shown as `Elasticidad`, but product wording requires `Flexibilidad`.
- Root cause:
  `TRAINING_CATEGORY_EDIT_OPTIONS` in `apps/mobile/App.tsx` used `label: "Elasticidad"` for the `flexibility` category.
- Exact fix steps/commands:
  1. Updated editor chip copy:
     - `TRAINING_CATEGORY_EDIT_OPTIONS.flexibility.label` -> `Flexibilidad`
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Training execution flow completed and full Train usability hardened
- Failure:
  The training area allowed creating/editing routines but lacked a complete, usable execution flow (active workout session), and critical interactions (menu actions and end-to-end QA coverage) were not reliably testable.
- Root cause:
  `apps/mobile/App.tsx` had no explicit session state machine for active workouts (start/pause/resume/rest/progress/finish/discard), no persistence for in-progress sessions, and no deterministic selectors for automation around contextual menus.
- Exact fix steps/commands:
  1. Added active workout session model and lifecycle in `apps/mobile/App.tsx`:
     - new types: `WorkoutSession`, `WorkoutSessionSummary`, session status, and series pointer helpers.
     - new storage key: `SESSION_STORAGE_KEY` with AsyncStorage persistence/hydration.
     - new runtime helpers: `listTemplateSeriesPointers`, `pointerKey`, `normalizeWorkoutSession`, `formatClock`, `templateHasRunnableSeries`.
  2. Implemented complete execution handlers:
     - `startTrainingSession()`
     - `completeCurrentSessionSeries()`
     - `moveWorkoutSessionPointer()`
     - `pauseWorkoutSession()` / `resumeWorkoutSession()`
     - `skipSessionRest()`
     - `finishActiveWorkoutSession()` / `finishWorkoutSession()`
     - `discardWorkoutSession()` with double-confirmation.
  3. Added active session UI in Train tab:
     - progress (`x/y` series), elapsed clock, state, current series card, rest countdown, and controls (`Anterior`, `Marcar serie hecha`, `Siguiente`, `Pausar/Reanudar`, `Finalizar`, `Abandonar`).
  4. Improved Train editing/list UX:
     - added `Iniciar entrenamiento` in editor (disabled until there are runnable series).
     - added `Iniciar entrenamiento` action in routine list menu.
     - added “Último entrenamiento completado” summary card after session completion.
  5. Added `testID` hooks to critical controls for deterministic E2E validation:
     - routine menu/actions, exercise menu/actions, editor start/add buttons, session control buttons.
  6. Validated TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  7. Executed manual E2E usability sweep with Playwright on web:
     - open Train, filter/search, create routine, edit all fields, add/clone/move/delete exercises, clone/move/delete routines, start sessions, complete series with rest, pause/resume, skip rest, finish/discard flows.

### 2026-02-22 - Reproducible Playwright E2E script added for Train usability
- Failure:
  Manual Playwright checks were possible ad-hoc, but there was no single reproducible command in the repo to validate all critical training flows (create/edit/move/clone/delete routines and execute sessions end-to-end).
- Root cause:
  The project did not include a dedicated Playwright automation script, root command entrypoint, or local browser runtime installation path for this scenario.
- Exact fix steps/commands:
  1. Installed Playwright as root dev dependency:
     `npm install --save-dev playwright`
  2. Added reusable E2E script:
     - file: `apps/mobile/scripts/train-usability.e2e.mjs`
     - covers full Train flow:
       - reset local data
       - create/edit routine
       - edit series and validate duration behavior
       - clone/move/delete exercises
       - clone/move/delete routines
       - start/pause/resume/complete/discard session
  3. Added root npm scripts:
     - `test:train:e2e`
     - `test:train:e2e:headed`
  4. Installed Chromium runtime for Playwright:
     `npx playwright install chromium`
  5. Verified automated run passes:
     `npm run test:train:e2e`

### 2026-02-22 - Routine tap now starts training session; edit is menu-only
- Failure:
  Tapping a routine card in `Train` opened the routine editor directly, but expected behavior is:
  - tap card -> open workout execution screen
  - edit routine -> only from kebab menu (`Editar rutina`).
- Root cause:
  In the routines list UI, the full routine card `Pressable` was wired to `openTrainingTemplate(tpl.id)` instead of starting a workout session. Additionally, the active session screen did not match the intended visual hierarchy from the design reference.
- Exact fix steps/commands:
  1. Updated routine card primary action in `apps/mobile/App.tsx`:
     - card `onPress` now calls `startTrainingSession(tpl.id)`.
     - editor remains reachable only from menu action `Editar rutina`.
  2. Refined active session screen to match reference style:
     - top status row (`Sesión activa`), timer, red `Finalizar` button.
     - progress bar with `%` and completed series.
     - stacked exercise cards with expanded current exercise, set table (`REPS/PESO/DESCANSO`), and active/rest states.
     - integrated `Marcar serie hecha`, `Pausar/Reanudar`, `Abandonar`, and rest skip/progress row.
  3. Added session-focused helpers/derived state:
     - per-exercise completion model for active session rendering.
     - `focusWorkoutSessionExercise()` to switch current exercise by tapping exercise cards.
  4. Validated TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  5. Validated Train E2E automation remains green:
     `npm run test:train:e2e`
  6. Manual Playwright spot-check:
     - create routine, back to list, tap routine card -> confirms `Sesión activa` screen (not editor).

### 2026-02-22 - Added bottom `+ Agregar ejercicio` button in routine editor
- Failure:
  In routine edit screen, users only had `Guardar cambios` at the bottom and requested a second quick-add entry point for exercises right above it.
- Root cause:
  The editor had `+ Agregar ejercicio` only in the upper section; there was no bottom CTA near the save action.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` in active routine editor view:
     - inserted new bottom button above `Guardar cambios`:
       - label: `+ Agregar ejercicio`
       - action: `addExerciseToActiveTemplate`
       - test id: `training-editor-add-exercise-bottom`
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-22 - Rest end alert now triggers sound + vibration during training session
- Failure:
  When rest countdown reached zero while performing a routine, there was no explicit end-of-rest alert.
- Root cause:
  Active session timer logic updated `rest_seconds_left`/`is_resting` but did not trigger any sensory notification on the rest-complete transition.
- Exact fix steps/commands:
  1. Installed Expo audio module for reliable in-app sound playback on mobile:
     `npm --workspace apps/mobile exec expo install expo-av`
  2. Added local short beep asset:
     - file: `apps/mobile/assets/rest-finished.wav`
  3. Updated `apps/mobile/App.tsx`:
     - imported `expo-av` (`Audio`) and React Native `Alert` + `Vibration`
     - added `playRestFinishedAlert()` to:
       - play brief beep
       - vibrate device
       - show alert (`Descanso terminado`)
     - added rest transition detection effect to fire alert only when countdown reaches zero naturally
     - prevented false positives on manual skip (`manualRestSkipRef`)
     - added cleanup to unload sound on unmount.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  5. Re-ran Train usability E2E regression:
     `npm run test:train:e2e`

### 2026-02-22 - Exercise context menu now uses real icons and divider before delete
- Failure:
  In routine editor exercise menu, actions showed letter placeholders (`E`, `C`, `M`, `D`) instead of the icon style required by design reference, and there was no separator before destructive action.
- Root cause:
  Menu rows were rendered with plain text initials and lacked a dedicated divider element between normal and destructive groups.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` exercise menu rendering:
     - replaced initials with `Feather` icons:
       - `edit-2` for `Editar ejercicio`
       - `copy` for `Clonar ejercicio`
       - `move` for `Mover posición`
       - `trash-2` for `Eliminar ejercicio`
     - inserted horizontal divider line between `Mover posición` and `Eliminar ejercicio`.
  2. Added missing icon dependency compatible with SDK 54:
     `npm --workspace apps/mobile exec expo install @expo/vector-icons`
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  4. Re-ran Train usability E2E regression:
     `npm run test:train:e2e`

### 2026-02-23 - Series table in routine editor aligned to design reference
- Failure:
  In routine editor, the series table looked cramped: set and reps appeared visually stuck together, values were not clearly aligned under `REPS/KG/DESC`, and the 6-dot drag affordance on each series row was hard to see.
- Root cause:
  The table relied on loose flex spacing with oversized input typography and tiny low-contrast drag dots, which produced unstable visual alignment across device widths.
- Exact fix steps/commands:
  1. Updated series table layout in `apps/mobile/App.tsx` to use fixed per-column widths and explicit horizontal gaps for `#`, `REPS`, `KG`, and `DESC`.
  2. Kept all inputs centered in their column to avoid visual concatenation (`1` + `10` appearing as `110`).
  3. Reworked the series drag handle to a clearer 2x3 dot grid with higher contrast on the right side of each row.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  5. Validated web bundling still compiles:
     `cd apps/mobile && npx expo export --platform web --dev`
  6. Manual Playwright visual verification in web preview:
     confirmed improved spacing/alignment and visible six-dot handles in routine editor.

### 2026-02-23 - Series table now uses full available width in routine editor
- Failure:
  After improving spacing, the series table columns became too rigid and looked fixed-width instead of adapting to the full card width.
- Root cause:
  `REPS`, `KG`, and `DESC` columns used hardcoded pixel widths, leaving unused space on wider layouts.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` series table header and rows:
     - kept `#` and drag-handle columns fixed
     - changed `REPS`, `KG`, `DESC` to fluid columns with `flex: 1` + `minWidth: 0`
     - preserved centered text for stable readability.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Exercise action menu now always renders above other exercise cards
- Failure:
  In routine editor, opening the `...` menu on an exercise could render the menu behind neighboring exercise cards, making actions partially hidden.
- Root cause:
  Exercise cards shared the same stacking level, so the open menu container did not consistently win the z-order against sibling cards.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` exercise card wrapper:
     - when menu is open, raise card stacking with `zIndex` and `elevation`.
  2. Updated menu popover container:
     - increased `zIndex`/`elevation` to keep the popover in front.
  3. Ensured card container allows overlay rendering:
     - set `overflow: "visible"` on the exercise card view.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  5. Manual Playwright verification:
     - opened editor, created multiple exercises, opened first exercise menu, and confirmed visually that menu overlays cards below.

### 2026-02-23 - Routines list (`Mis Rutinas`) menu now uses icons and always stays on top
- Failure:
  In the routines list kebab menu, actions displayed text placeholders (`E`, `C`, `M`, `D`) instead of icons, and the menu could be covered by other routine cards.
- Root cause:
  The routine actions were still rendered as plain letters, and the routine card/menu layer priority was too low when the menu was open.
- Exact fix steps/commands:
  1. Updated routine menu actions in `apps/mobile/App.tsx` to use `Feather` icons:
     - `play`, `edit-2`, `copy`, `move`, `trash-2`.
  2. Improved visual grouping by adding divider spacing before `Eliminar rutina`.
  3. Raised z-order for open routine menu:
     - routine wrapper uses elevated `zIndex`/`elevation` when open.
     - menu popover uses higher `zIndex`/`elevation`.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  5. Manual Playwright verification:
     - opened `Train` > `Mis Rutinas`, opened first kebab menu, confirmed icons render and menu stays above other cards.

### 2026-02-23 - Train tab now shows loading skeleton with simulated local data delay
- Failure:
  Entering `Train` loaded routine data instantly from local storage, so there was no visible loading phase to validate the loading-state design.
- Root cause:
  The app only used a global startup spinner (`loading`) and did not have a dedicated loading state for the routines list screen.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` with a dedicated Train-list loading state:
     - added `isTrainingDataLoading` state and `trainingLoadTimeoutRef`.
     - added `showTrainingListSkeleton` guard for `Train` list screen only.
  2. Added artificial delay for local data simulation:
     - `TRAINING_LOAD_SIMULATION_DELAY_MS = 1200`.
     - on entering `Train` list view, show skeleton and hide it after delay.
  3. Implemented skeleton UI matching the design direction:
     - search bar placeholder
     - filter chips placeholders
     - stacked routine card placeholders
  4. Prevented list UI overlap while loading:
     - hide routine count badge and floating `+ Nueva rutina` button during skeleton.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  6. Manual Playwright verification:
     - entered `Train` and confirmed `training-list-loading-skeleton` is visible immediately and hidden after delay.

### 2026-02-23 - Global switch added to simulate loading delay across all tabs/screens
- Failure:
  There was no single global control to force delayed loading across screens, making it hard to verify loading states consistently on every tab.
- Root cause:
  Delay simulation existed only for `Train` list flow; other tabs rendered content immediately after hydration.
- Exact fix steps/commands:
  1. Added global delay flags in `apps/mobile/App.tsx`:
     - `ENABLE_GLOBAL_SCREEN_LOAD_DELAY = true`
     - `GLOBAL_SCREEN_LOAD_DELAY_MS = 1200`
  2. Added global screen-loading state/timeout:
     - `isGlobalScreenLoading`
     - `globalScreenLoadTimeoutRef`
     - effect triggered on tab changes after hydration.
  3. Added per-tab skeleton rendering branch when global delay is active:
     - test IDs: `screen-loading-skeleton-home|diet|measures|chat|settings`
  4. Integrated with Train skeleton:
     - `showTrainingListSkeleton` now also respects global delay.
  5. Kept floating Train CTA hidden while Train skeleton is active.
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  7. Manual Playwright verification:
     - changed tabs and confirmed skeleton appears at entry and disappears after delay on `Dieta`, `Stats`, `Chat`, `Cfg`, and `Train`.

### 2026-02-23 - Routine editor now shows loading skeleton on edit/create flows
- Failure:
  Editing or creating a routine switched directly to the editor content without an intermediate loading skeleton, so that transition could not be visually validated.
- Root cause:
  Loading simulation existed for tab-level screens but there was no dedicated loading state for the training routine editor route (`activeTrainingTemplateId` flow).
- Exact fix steps/commands:
  1. Added editor-specific loading state in `apps/mobile/App.tsx`:
     - `isTrainingEditorLoading`
     - `trainingEditorLoadTimeoutRef`
     - `showTrainingEditorSkeleton`
  2. Added delay effect for editor entry:
     - triggers when entering training editor (`tab=training`, `activeTrainingTemplateId` set, no active session).
     - uses `GLOBAL_SCREEN_LOAD_DELAY_MS` and `ENABLE_GLOBAL_SCREEN_LOAD_DELAY`.
  3. Added visual skeleton for editor screen:
     - top back/save placeholders
     - title/meta placeholders
     - action button placeholders
     - exercise card placeholders
     - bottom save placeholder
  4. Prevented list floating CTA from appearing during editor skeleton:
     - `+ Nueva rutina` now hidden when `showTrainingEditorSkeleton` is true.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  6. Manual Playwright verification:
     - `Editar rutina` flow: skeleton visible immediately, hidden after delay.
     - `Nueva rutina` flow: skeleton visible immediately, hidden after delay.

### 2026-02-23 - Disabled all load-delay simulations after validation phase
- Failure:
  Even after disabling the global delay switch, `Train` could still show loading because it had its own independent simulation toggle path.
- Root cause:
  The Train list simulation effect (`isTrainingDataLoading`) was not tied to the global switch and could remain active separately.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx`:
     - added `ENABLE_TRAIN_LIST_LOAD_SIMULATION = false`
     - gated Train-list delay effect with that flag.
  2. Confirmed global delay remains disabled:
     - `ENABLE_GLOBAL_SCREEN_LOAD_DELAY = false`
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Unified delay control to a single global variable
- Failure:
  Delay simulation was controlled by more than one toggle, causing inconsistent behavior and making it unclear which switch controlled each loading state.
- Root cause:
  `Train` list still had a dedicated simulation flag/path in parallel with the global delay flag.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` to use only one delay toggle:
     - kept `ENABLE_GLOBAL_SCREEN_LOAD_DELAY`
     - removed `ENABLE_TRAIN_LIST_LOAD_SIMULATION`
     - removed `TRAINING_LOAD_SIMULATION_DELAY_MS`
     - removed train-list specific loading state/ref/effect (`isTrainingDataLoading`, `trainingLoadTimeoutRef`).
  2. Kept Train list skeleton driven by the same global delay state as the rest of screens.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Routine icons are now selectable in editor and rendered per-routine
- Failure:
  In `Mis Rutinas`, cards did not expose editable per-routine icon choice; users could not pick an icon variant when editing a routine.
- Root cause:
  Routine cards used category-based placeholder letters (`S/C/F`) from `trainingCategoryMeta` and the routine data model had no explicit user-selectable icon field.
- Exact fix steps/commands:
  1. Extended routine model in `apps/mobile/App.tsx`:
     - added `icon?: RoutineIconName` to `WorkoutTemplate`.
     - added icon catalog and category defaults (`ROUTINE_ICON_OPTIONS`, `ROUTINE_ICON_BY_CATEGORY`).
  2. Added icon normalization/defaulting:
     - `normalizeTemplateIcon(...)` validates stored icon values.
     - `defaultTemplateIcon(...)` provides deterministic fallback by category/index.
     - integrated in store normalization for legacy routines without icon.
  3. Added editor controls:
     - new horizontal icon picker in routine editor (`training-icon-picker`).
     - selectable options `training-icon-option-<iconName>`.
     - persisting via `updateActiveTrainingIcon(...)`.
  4. Updated routine list rendering:
     - replaced letter placeholder with selected `Feather` icon in each card.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  6. Manual Playwright verification:
     - opened routine editor, selected a different icon, saved, and confirmed icon appears on the routine card in `Mis Rutinas`.

### 2026-02-23 - Routine drag handle dots rendered as 2x3 grid in list cards
- Failure:
  In `Mis Rutinas`, the left drag handle appeared as a single vertical column of 6 dots instead of two columns (2x3) like the reference design.
- Root cause:
  The routine card handle renderer used a flat loop of 6 dots in one column (`Array.from({ length: 6 })`).
- Exact fix steps/commands:
  1. Updated routine card handle in `apps/mobile/App.tsx`:
     - replaced single-column dot mapping with 3 rows × 2 dots each.
     - kept existing color/size style to preserve visual language.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Added `Hipertrofia` as first-class training category
- Failure:
  Train flows only supported `Fuerza`, `Cardio` and `Flexibilidad`; user could not select or filter routines by `Hipertrofia`.
- Root cause:
  The category union/types, filter chips, editor category options, normalization guards, and category metadata did not include a hypertrophy variant.
- Exact fix steps/commands:
  1. Extended category types/options in `apps/mobile/App.tsx`:
     - `TrainingFilter` and `TrainingCategory` now include `hypertrophy`.
     - Added `Hipertrofia` chip to list filters and routine editor category selector.
  2. Updated category inference/resolution:
     - `inferTrainingCategory(...)` now detects `hipertrof*`, `hypertroph*`, `volumen`, `masa muscular`.
     - `resolveTrainingCategory(...)` now accepts stored `hypertrophy`.
  3. Updated category visuals:
     - `trainingCategoryMeta(...)` includes `Hipertrofia` with dedicated purple color/badge style.
  4. Updated normalization and defaults:
     - store normalization now keeps `template.category === "hypertrophy"`.
     - default template naming now includes `Hipertrofia — Volumen N`.
  5. Updated exercise defaults for hypertrophy routines:
     - hypertrophy now behaves as load-focused category for initial series (`weight_kg`, `rest_seconds`, `load_kg`).
  6. Updated routine icon defaults map to include hypertrophy.
  7. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Active workout screen supports in-session set editing and rest pause control
- Failure:
  During an active workout, `reps`, `peso`, and `descanso` were read-only; completed exercise subtitle text stayed gray; and rest timer block lacked an inline pause/reanudar action.
- Root cause:
  The active session table rendered static `Text` cells for all set fields, completion subtitle color was fixed, and only `Saltar` existed in the rest block actions.
- Exact fix steps/commands:
  1. Added shared updater in `apps/mobile/App.tsx`:
     - `updateExerciseSeriesFieldInTemplate(...)` to update set fields and keep legacy derived fields (`sets`, `load_kg`, `rest_seconds`) consistent.
  2. Rewired editor/session updates:
     - `updateExerciseSeriesFieldInActiveTemplate(...)` now delegates to shared updater.
     - Added `updateExerciseSeriesFieldInActiveSession(...)` for active workout edits.
  3. Updated active workout set rows:
     - current set row now renders editable `TextInput` controls for `reps`, `weight_kg`, `rest_seconds`.
     - non-current rows remain read-only for clarity.
  4. Updated completed exercise subtitle style:
     - when an exercise is fully completed, subtitle (`músculo · x/y series`) renders green.
  5. Added pause/reanudar control inside rest timer block:
     - new inline action in rest panel using existing session status toggles.
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Rest controls switched to circular icon buttons (pause + skip)
- Failure:
  Rest controls still displayed text labels (`Pausar` and `Saltar`) instead of compact icon actions as required by the training design.
- Root cause:
  The rest action row rendered plain `Text` nodes inside `Pressable` elements and did not provide icon-circle styling.
- Exact fix steps/commands:
  1. Updated rest action controls in `apps/mobile/App.tsx`:
     - replaced text labels with `Feather` icons.
     - pause control now uses `pause` (and `play` when paused) inside a circular button.
     - skip control now uses `rotate-cw` inside a circular button.
  2. Kept existing behavior and test hooks:
     - `training-session-rest-toggle-pause`
     - `training-session-skip-rest`
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Rest skip control switched to requested Ionicons glyph
- Failure:
  The skip-rest circular button used a generic rotate icon, but design feedback required a specific glyph: `arrow-redo-circle-outline`.
- Root cause:
  Skip control was still bound to `Feather` icon set (`rotate-cw`), which does not provide the requested icon name.
- Exact fix steps/commands:
  1. Updated icon import in `apps/mobile/App.tsx`:
     - from `Feather` only to `Feather, Ionicons`.
  2. Replaced skip-rest icon:
     - `Feather rotate-cw` -> `Ionicons arrow-redo-circle-outline`.
  3. Kept same behavior/test hook:
     - `training-session-skip-rest`.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Active session header icons aligned to design reference
- Failure:
  The active session header still showed a text stopwatch emoji and the `Finalizar` button had no leading flag icon, differing from the reference UI.
- Root cause:
  Header controls were rendered as plain text (`⏱`) and text-only CTA without icon composition.
- Exact fix steps/commands:
  1. Updated active session timer display in `apps/mobile/App.tsx`:
     - replaced text emoji with `Ionicons` `timer-outline` next to elapsed time.
  2. Updated `Finalizar` CTA in `apps/mobile/App.tsx`:
     - added `Feather` `flag` icon at the start of the button label.
     - adjusted button content layout to row with spacing.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Workout completion now uses modal with change-application decision
- Failure:
  Finishing a training session only surfaced a small inline summary card in `Mis Rutinas`; there was no completion modal matching the target UX, and users could not decide whether in-session set edits should be applied to the routine.
- Root cause:
  Session completion flow ended at `setLastWorkoutSessionSummary(...)` + `setActiveWorkoutSession(null)` without any modal state, and set edits were written directly to the template with no post-session confirmation path.
- Exact fix steps/commands:
  1. Extended completion/session models in `apps/mobile/App.tsx`:
     - `WorkoutSessionSummary` now includes `template_id` and `estimated_calories`.
     - added `WorkoutCompletionModalState`.
  2. Added completion helpers:
     - `cloneWorkoutTemplate(...)`
     - `buildTemplateSeriesSignature(...)`
     - `estimateWorkoutCalories(...)`
  3. Added session-start snapshot and completion modal state:
     - `workoutTemplateBeforeSessionRef`
     - `workoutCompletionModal`
  4. Updated session lifecycle:
     - on session start, snapshot template baseline.
     - on finish, compute calories + detect series-field changes (reps/weight/rest) against baseline.
     - open completion modal with CTA choices:
       - `Sí, actualizar rutina` (keeps edited values)
       - `No, mantener la original` (restores baseline template)
  5. Added centered overlay modal UI in `apps/mobile/App.tsx` styled to the reference:
     - trophy icon badge, elapsed time, series, calories, and `Cambios detectados` block.
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  7. Manual Playwright smoke verification:
     - started web app, created/started routine, edited current series, completed session.
     - verified modal appears with `¡Sesión completada!` and `Cambios detectados`.
     - verified apply button closes modal and keeps changes.

### 2026-02-23 - Rest timer no longer stops on incidental screen taps
- Failure:
  During rest after completing a series, tapping on the workout screen (exercise cards or prev/next controls) could stop/reset rest unintentionally.
- Root cause:
  Interaction handlers (`focusWorkoutSessionExercise` and `moveWorkoutSessionPointer`) always forced `is_resting=false` and `rest_seconds_left=0`, so incidental taps interrupted rest flow.
- Exact fix steps/commands:
  1. Updated session handlers in `apps/mobile/App.tsx`:
     - `moveWorkoutSessionPointer(...)` now returns early when `activeWorkoutSession.is_resting`.
     - `focusWorkoutSessionExercise(...)` now returns early when `activeWorkoutSession.is_resting`.
     - `completeCurrentSessionSeries(...)` now returns early while resting.
  2. Updated active-session controls/UI:
     - exercise card pressables are disabled while resting.
     - `Marcar serie hecha` button is disabled (and visually dimmed) while resting.
     - `Anterior`/`Siguiente` buttons are disabled (and visually dimmed) while resting.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  4. Manual Playwright verification:
     - started session, entered rest, tapped `Anterior`/`Siguiente` and workout card area.
     - confirmed rest countdown keeps progressing.
     - confirmed pause button freezes timer and reanudar resumes.
     - confirmed skip button exits rest block.

### 2026-02-23 - Completed-set tick now toggles series back to pending
- Failure:
  Once a set was marked complete (green tick), there was no way to undo it from the active workout table.
- Root cause:
  Completed-state rendering used a static indicator with no interaction; session state only had forward completion flow.
- Exact fix steps/commands:
  1. Added undo handler in `apps/mobile/App.tsx`:
     - `markSessionSeriesAsNotDone(exerciseId, seriesId)` removes the set from `completed_series_keys`, updates `completed_series_count`, focuses the session pointer on that set, and exits rest state if needed.
  2. Wired the completed indicator as interactive control:
     - replaced static series circle container with `Pressable`.
     - pressing the green tick now calls `markSessionSeriesAsNotDone(...)`.
     - non-completed rows stay non-interactive.
  3. Prevented side effects:
     - handler stops event propagation to avoid triggering parent card press behavior.
     - if rest was active, marks it as manual skip to prevent rest-finished alert.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Android APK generated for device installation
- Failure:
  Needed an installable Android artifact (`.apk`) to test on physical mobile device.
- Root cause:
  Local Expo run does not produce a distributable APK by itself; cloud build via EAS profile was required.
- Exact fix steps/commands:
  1. Verified build profile in `apps/mobile/eas.json`:
     - `build.preview.android.buildType = "apk"`.
  2. Launched remote APK build:
     - `cd apps/mobile && npx eas-cli build --platform android --profile preview --non-interactive`
  3. Monitored build status until completion:
     - `cd apps/mobile && npx eas-cli build:view 1d1df6c6-bd00-4b98-9911-063faca240ef --json`
  4. Final artifact:
     - Build ID: `1d1df6c6-bd00-4b98-9911-063faca240ef`
     - APK URL: `https://expo.dev/artifacts/eas/4AxfCaMu5NSMtJVwvJRMjx.apk`
  5. Optional local download for direct install:
     - `curl -L "https://expo.dev/artifacts/eas/4AxfCaMu5NSMtJVwvJRMjx.apk" -o /tmp/gymnasia-preview-1d1df6c6.apk`

### 2026-02-23 - Moved primary tab selector from bottom overlay to top header area
- Failure:
  On Android devices with system navigation buttons at the bottom, the app tabs (`Home`, `Train`, `Dieta`, `Stats`, `Chat`, `Cfg`) could be visually/interaction-overlapped by OS controls.
- Root cause:
  The tab selector was implemented as an absolute bottom bar (`position: absolute; bottom: 0; height: 64`) inside `apps/mobile/App.tsx`.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx` layout:
     - removed the fixed bottom tab bar block.
     - added a top tab selector row directly below the header/title area.
  2. Preserved behavior and labels:
     - kept same six tabs and `setTab(...)` interactions.
     - active tab now highlighted in the top row with brand accent styles.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Added diet goals and body-weight sections in Settings
- Failure:
  Settings only exposed provider chat configuration; users could not configure daily calories, macro distribution rules, or body weight directly from `Cfg`.
- Root cause:
  `apps/mobile/App.tsx` lacked a persisted nutrition-settings model and corresponding UI/actions for macro planning (manual kcal or protein by body-weight).
- Exact fix steps/commands:
  1. Extended local store model in `apps/mobile/App.tsx`:
     - added `dietSettings` to `LocalStore`.
     - added defaults and migration-safe normalization (`createDefaultDietSettings`, `normalizeDietSettings`).
  2. Added nutrition planning logic in `apps/mobile/App.tsx`:
     - manual mode (`manual_calories`) with per-macro kcal inputs and remaining-calories feedback.
     - body-weight mode (`protein_by_weight`) with protein g/kg calculation and automatic split of remaining calories across carbs/fats.
  3. Added new Settings UI sections in `apps/mobile/App.tsx`:
     - `Plan de dieta` (calories + macro split modes).
     - `Peso corporal` (save current body weight for g/kg calculations).
  4. Kept chat provider configuration intact under the new sections.
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Simplified diet-mode chip labels in Settings
- Failure:
  Diet mode chips were shown as `Manual kcal` and `Proteína g/kg`, but product copy requested shorter labels.
- Root cause:
  `DIET_MACRO_MODE_OPTIONS` labels in `apps/mobile/App.tsx` used verbose text.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx`:
     - `manual_calories` label -> `kcal`
     - `protein_by_weight` label -> `g/kg`
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `g/kg` mode now accepts protein, carbs and fat grams
- Failure:
  In `g/kg` mode, settings only allowed entering protein grams-per-kg and split the remaining calories by percentage, so users could not directly enter carb and fat grams.
- Root cause:
  Diet settings model and UI in `apps/mobile/App.tsx` only had `protein_grams_per_kg` plus `remaining_carbs_percent`.
- Exact fix steps/commands:
  1. Updated nutrition settings model in `apps/mobile/App.tsx`:
     - removed `remaining_carbs_percent`.
     - added `carbs_grams_per_kg` and `fat_grams_per_kg`.
     - adjusted defaults and normalization (`createDefaultDietSettings`, `normalizeDietSettings`).
  2. Updated `g/kg` calculations:
     - grams for P/C/G are now calculated from body weight and each per-kg input.
     - macro calories are computed from those grams (`P*4`, `C*4`, `G*9`).
     - remaining/excess calories are shown against daily target.
  3. Updated `g/kg` settings UI:
     - added inputs for `Carbohidratos (g por kg corporal)` and `Grasas (g por kg corporal)`.
     - kept protein input and replaced percentage-based distribution copy with per-kg summary.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `g/kg` placeholders now show dynamic max grams
- Failure:
  In `g/kg` mode, users could enter per-kg grams but placeholders of the other macro inputs did not show how many grams still fit within daily calories.
- Root cause:
  Placeholder text in `apps/mobile/App.tsx` was static and not connected to macro-calorie calculations.
- Exact fix steps/commands:
  1. Added dynamic max-grams hint calculations in `apps/mobile/App.tsx`:
     - computes per-macro max grams using daily calories and currently configured values of the other two macros.
     - activates hints only when daily calories + body weight are available and at least one macro/kg value is set.
  2. Updated placeholders in `g/kg` inputs:
     - `Proteína (g por kg corporal) (x g max)`
     - `Carbohidratos (g por kg corporal) (x g max)`
     - `Grasas (g por kg corporal) (x g max)`
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `g/kg` placeholder limits switched from total grams to grams-per-kg
- Failure:
  Dynamic placeholders in `g/kg` mode were showing maximum total grams, but UX requirement was to show maximum grams-per-kg.
- Root cause:
  Max hint formulas in `apps/mobile/App.tsx` computed only total grams from calories and did not normalize by body weight.
- Exact fix steps/commands:
  1. Updated max-hint formulas in `apps/mobile/App.tsx`:
     - divide each macro max-grams value by current body weight to get `g/kg` limits.
  2. Updated placeholder copy:
     - now displays `(... g/kg max)` for proteína, carbohidratos, y grasas.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `g/kg` mode now shows `Auto` button on the third macro
- Failure:
  When two macro values were entered in `g/kg` mode, users still had to manually compute and type the third one.
- Root cause:
  The `g/kg` UI in `apps/mobile/App.tsx` had no autocompletion trigger tied to calories target and body weight.
- Exact fix steps/commands:
  1. Added missing-macro detection in `apps/mobile/App.tsx`:
     - detects when exactly two of `proteína/carbohidratos/grasas` are > 0.
     - identifies the third macro as autocompletable.
  2. Added autocompletion calculation + action:
     - computes required `g/kg` for the missing macro from daily calories, weight, and the other two macros.
     - new handler `autocompleteMissingGkgMacro()` writes the computed value into the missing field.
  3. Updated `g/kg` inputs UI:
     - each macro input is now a row.
     - if that macro is the only missing one, shows a right-side `Auto` button.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Switching from `g/kg` to `kcal` now fills kcal equivalents
- Failure:
  After entering macro targets in `g/kg`, switching to `kcal` mode did not populate the calorie fields with equivalent macro calories.
- Root cause:
  `setDietMacroMode()` in `apps/mobile/App.tsx` only changed mode and did not map `g/kg` values to `manual_macro_calories`.
- Exact fix steps/commands:
  1. Updated `setDietMacroMode()` in `apps/mobile/App.tsx`:
     - when switching from `protein_by_weight` to `manual_calories`, compute kcal from current body weight and per-kg inputs:
       - proteína: `peso * g/kg * 4`
       - carbohidratos: `peso * g/kg * 4`
       - grasas: `peso * g/kg * 9`
     - populate `manual_macro_calories` with the computed kcal values.
     - keep previous behavior when weight is missing or no `g/kg` values are set.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Added nested tabs inside `Cfg` (`Medidas`, `Dieta`, `Gráficas`, `Proveedor IA`)
- Failure:
  The settings screen was a single long view and did not provide the requested internal tabbed navigation by area.
- Root cause:
  `tab === "settings"` in `apps/mobile/App.tsx` rendered all sections sequentially without a local stateful sub-navigation model.
- Exact fix steps/commands:
  1. Added settings sub-tab model in `apps/mobile/App.tsx`:
     - new type: `SettingsTabKey`.
     - new options: `SETTINGS_TAB_OPTIONS` with labels `Medidas`, `Dieta`, `Gráficas`, `Proveedor IA`.
     - new local state: `settingsTab`.
  2. Reworked `Cfg` UI into segmented sections:
     - `Medidas`: weight capture + latest measurements list (prepared for adding more measurements later).
     - `Dieta`: existing diet planning controls and macro workflows.
     - `Gráficas`: placeholder dashboard block for future charting.
     - `Proveedor IA`: existing provider/API-key configuration and local reset action.

### 2026-02-23 - Fixed settings tab label typo (`Proveedor IA`)
- Failure:
  The settings provider tab label was shown as `Proovedor IA` instead of `Proveedor IA`.
- Root cause:
  Typo in tab option label and section heading text in `apps/mobile/App.tsx`, and mirrored typo in maintenance notes.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx`:
     - `Proovedor IA` -> `Proveedor IA` in settings tab chip.
     - `Proovedor IA` -> `Proveedor IA` in provider section heading.
  2. Updated `AGENTS.md` historical entry text to keep terminology consistent.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  3. Preserved existing diet/provider logic while relocating them under the new nested tabs.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Fixed settings tab label typo (`Gráficas`)
- Failure:
  The new settings sub-tab was labeled `Grçaficas` instead of `Gráficas`.
- Root cause:
  Typo in `SETTINGS_TAB_OPTIONS` and in the section heading text inside `apps/mobile/App.tsx`.
- Exact fix steps/commands:
  1. Updated labels in `apps/mobile/App.tsx`:
     - `Grçaficas` -> `Gráficas` in the tab chip.
     - `Grçaficas` -> `Gráficas` in the section title.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Settings `Medidas` now supports full body measurements, photo and calendar date
- Failure:
  In `Cfg > Medidas`, users could only save body weight with an automatic timestamp and could not register photo, editable date, height or body circumference fields.
- Root cause:
  `Measurement` model and UI in `apps/mobile/App.tsx` only contained `weight_kg`, plus a basic save flow (`addWeight`) without media picker or date picker.
- Exact fix steps/commands:
  1. Extended `Measurement` model in `apps/mobile/App.tsx` to include:
     - `photo_uri`
     - `height_cm`
     - `neck_cm`, `chest_cm`, `waist_cm`, `hips_cm`, `biceps_cm`, `quadriceps_cm`, `calf_cm`
  2. Added backward-compatible normalization/migration:
     - new helpers to parse/normalize legacy measurement entries
     - date-safe sorting by `measured_at`
  3. Rebuilt `Cfg > Medidas` UI:
     - date selector with calendar (`DateTimePicker`) defaulting to current day
     - photo picker (`expo-image-picker`) with preview and remove action
     - inputs for peso, contornos, and altura (placed at the end)
     - new save action `Guardar medidas` with per-field validation and record list rendering
  4. Added new dependencies for Expo SDK 54:
     `npm --workspace apps/mobile exec expo install expo-image-picker @react-native-community/datetimepicker`
  5. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Removed helper copy under height field in settings measurements
- Failure:
  In `Cfg > Medidas`, helper copy under the height input (`Altura al final porque normalmente no cambia`) was no longer desired.
- Root cause:
  Static UX copy remained in the measurements form after the new fields rollout.
- Exact fix steps/commands:
  1. Updated `apps/mobile/App.tsx`:
     - removed the helper `Text` node below `Altura (cm)` input in `settingsTab === "measures"`.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `Proveedor IA` tab redesigned to match settings reference cards
- Failure:
  The `Cfg > Proveedor IA` section used a plain list/input layout and did not match the target visual hierarchy from the design reference (`API Keys (BYOK)` cards with status pills, masked key row, and action buttons).
- Root cause:
  The existing provider UI in `apps/mobile/App.tsx` was optimized for basic configuration, not for the card-based design language used in `[Image #1]`.
- Exact fix steps/commands:
  1. Added provider UI metadata in `apps/mobile/App.tsx`:
     - labels/models/avatar color map (`PROVIDER_UI_META`).
  2. Added provider tab UI state/actions:
     - key visibility state per provider (`providerKeyVisibility`).
     - actions `toggleProviderKeyVisibility`, `rotateProviderApiKey`, `deleteProviderApiKey`.
  3. Replaced `settingsTab === "provider"` UI block:
     - top encrypted-storage info banner (blue card with shield icon).
     - title/description (`API Keys (BYOK)`).
     - ordered provider cards (`Anthropic`, `OpenAI`, `Google`) with:
       - provider avatar + model subtitle
       - connected/not-connected status pill
       - masked key row with show/hide toggle
       - `Rotar Key` + `Eliminar` actions
       - active-provider hint + active model editable input
     - preserved local reset button and SecureStore warning.
  4. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
  5. Verified Expo web bundling:
     `cd apps/mobile && npx expo export --platform web --dev`

### 2026-02-23 - Provider key input now editable while hidden
- Failure:
  In `Cfg > Proveedor IA`, users could only type API keys after pressing the eye button (visible mode). Hidden mode did not allow direct editing.
- Root cause:
  The key row conditionally rendered a non-editable `Text` when hidden, and only rendered `TextInput` when visible.
- Exact fix steps/commands:
  1. Updated provider key row in `apps/mobile/App.tsx`:
     - replaced conditional `Text`/`TextInput` rendering with a single always-editable `TextInput`.
     - applied `secureTextEntry={!keyVisible}` so hidden mode shows masked characters while still allowing typing.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `Rotar Key` replaced with `Guardar` in `Cfg > Proveedor IA`
- Failure:
  In `Cfg > Proveedor IA`, the primary secondary action button still showed `Rotar Key`, but the requested behavior/copy was to use `Guardar`.
- Root cause:
  The provider card action was still wired to `rotateProviderApiKey()` (destructive key reset flow) and rendered `Rotar Key` with a refresh icon.
- Exact fix steps/commands:
  1. Updated provider save action in `apps/mobile/App.tsx`:
     - replaced `rotateProviderApiKey()` with `saveProviderApiKey()`.
     - new handler trims and persists current `api_key`/`model`, keeps local-first persistence flow, and no longer clears the key.
  2. Updated provider card button UI:
     - changed icon `refresh-cw` -> `save`.
     - changed label `Rotar Key` -> `Guardar`.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Provider API key now saves only on `Guardar` and `Conectado` requires verification
- Failure:
  In `Cfg > Proveedor IA`, editing the API key field changed persisted provider config immediately, and status showed `Conectado` for any non-empty text even without validating provider access.
- Root cause:
  The key input wrote directly to `store.keys` on each keystroke, and connection badge logic was `hasApiKey ? "Conectado" : "No conectado"` instead of using a real connectivity check.
- Exact fix steps/commands:
  1. Added draft-only editing state in `apps/mobile/App.tsx`:
     - `providerDraftByProvider` now holds `api_key`/`model` while typing.
     - provider config persistence (`store.keys` + SecureStore effect) now updates only from `saveProviderApiKey()`.
  2. Added explicit provider verification on save:
     - new helper `verifyProviderConnection()` checks each provider endpoint (OpenAI/Anthropic/Google) on `Guardar`.
     - save flow now sets status to `Comprobando` and updates to `Conectado` only when verification succeeds.
  3. Reworked provider status model/UI:
     - added `providerConnectionStatus` states: `connected`, `disconnected`, `checking`, `unknown`.
     - badge no longer depends on mere key presence.
     - draft edits mark provider as `Sin verificar` until `Guardar`.
  4. Added per-provider save loading state:
     - disable save button while verifying and show `Guardando...`.
  5. Kept delete/reset coherent with new flow:
     - deleting key clears draft + persisted key and sets status `No conectado`.
     - reset local data now resets provider drafts/status/loading state.
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `Guardar` in `Proveedor IA` now matches `Guardar medidas` button style
- Failure:
  The `Guardar` button in `Cfg > Proveedor IA` had a dark secondary style, while the requested design was to match the primary style used by `Guardar medidas` in `Cfg > Medidas`.
- Root cause:
  Provider save button styles used custom dark background/border plus icon layout, instead of the shared primary CTA styling.
- Exact fix steps/commands:
  1. Updated provider save button styles in `apps/mobile/App.tsx`:
     - `backgroundColor` set to `mobileTheme.color.brandPrimary`.
     - removed dark border styling and icon/spinner row treatment.
     - text style aligned to `Guardar medidas`: `color: "#06090D"`, `fontWeight: "700"`.
  2. Preserved existing save/verify behavior:
     - still shows `Guardando...` during provider connection validation.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Provider helper/status copy color updated in `Cfg > Proveedor IA`
- Failure:
  Requested visual emphasis was missing for provider helper/status copy in the provider card:
  - `Proveedor activo para el chat.` should be green.
  - `Sin API key guardada.` should be red.
- Root cause:
  Both texts were rendered with the same neutral gray color.
- Exact fix steps/commands:
  1. Updated provider card text styles in `apps/mobile/App.tsx`:
     - active provider hint now uses green (`#24D68B`).
     - connection detail now uses red (`#FF8D8D`) when message contains `Sin API key guardada`.
     - non-target states keep neutral gray.
  2. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `Train` tab renamed to `Entrenamiento`
- Failure:
  Bottom navigation tab still displayed `Train` instead of the requested Spanish label `Entrenamiento`.
- Root cause:
  `tabLabel()` mapping in `apps/mobile/App.tsx` had `training: "Train"`.
- Exact fix steps/commands:
  1. Updated tab label mapping in `apps/mobile/App.tsx`:
     - `training: "Train"` -> `training: "Entrenamiento"`.
  2. Updated mobile usability script selector in `apps/mobile/scripts/train-usability.e2e.mjs`:
     - `clickNavTab(page, "Train")` -> `clickNavTab(page, "Entrenamiento")`.
     - adjusted related log copy to match the new tab name.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `Stats` tab renamed to `Estadísticas`
- Failure:
  Bottom navigation tab still displayed `Stats` instead of the requested Spanish label `Estadísticas`.
- Root cause:
  `tabLabel()` mapping in `apps/mobile/App.tsx` had `measures: "Stats"`.
- Exact fix steps/commands:
  1. Updated tab label mapping in `apps/mobile/App.tsx`:
     - `measures: "Stats"` -> `measures: "Estadísticas"`.
  2. Searched mobile scripts for `Stats` references:
     - no `apps/mobile/scripts` updates were required.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - `Cfg` tab renamed to `Configuración`
- Failure:
  Bottom navigation tab still displayed `Cfg` instead of the requested Spanish label `Configuración`.
- Root cause:
  `tabLabel()` mapping in `apps/mobile/App.tsx` had `settings: "Cfg"`.
- Exact fix steps/commands:
  1. Updated tab label mapping in `apps/mobile/App.tsx`:
     - `settings: "Cfg"` -> `settings: "Configuración"`.
  2. Updated mobile usability script selector in `apps/mobile/scripts/train-usability.e2e.mjs`:
     - `clickNavTab(page, "Cfg")` -> `clickNavTab(page, "Configuración")`.
  3. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`

### 2026-02-23 - Diet tab now supports day selector with arrows and calendar picker
- Failure:
  In `Dieta`, users could only edit foods for the current day and had no control to switch to previous/next days or jump to a specific date.
- Root cause:
  Diet state and CRUD flow in `apps/mobile/App.tsx` were hard-wired to `todayISO()` and the UI had no day selector above the calorie summary card.
- Exact fix steps/commands:
  1. Added diet date navigation state in `apps/mobile/App.tsx`:
     - `selectedDietDate` (active diet day key).
     - `showDietDatePicker` (calendar visibility).
  2. Added date helpers in `apps/mobile/App.tsx`:
     - ISO conversion/parsing helpers.
     - day shift helper for arrow navigation.
     - formatted labels for header date (`Viernes, 20 Feb`) and context (`Hoy`, `Ayer`, `Mañana`).
  3. Added Diet day selector UI in `apps/mobile/App.tsx`:
     - left/right arrows to move one day back/forward.
     - calendar icon to open `DateTimePicker` and select an exact day.
     - placed below tabs and above the calories summary card.
  4. Updated diet data flow to use selected day in `apps/mobile/App.tsx`:
     - `dietDay`, meal virtual ids, add/edit/delete item logic now read/write `store.dietByDate[selectedDietDate]`.
     - entering `Dieta` resets the active day to current date by default.
  5. Preserved "hoy" semantics outside Diet:
     - dashboard calories now read from `todayISO()` explicitly, independent of selected diet day.
  6. Validated mobile TypeScript:
     `npm --workspace apps/mobile exec tsc --noEmit`
