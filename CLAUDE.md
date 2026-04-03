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
- After each modification, create a commit and push it to the remote before closing the task.
- PR description should include: summary, impacted paths, commands executed, and screenshots for UI updates.

## Security & Configuration Tips
- Never commit secrets.

## Documentation Maintenance
- Keep `AGENTS.md` and root `CLAUDE.md` synchronized whenever repository instructions change.
- `AGENTS.md` es un link de `CLAUDE.md` por lo que modificando uno se debe actualizar el otro.
- Update `README.md` whenever the project structure, dependencies, or startup instructions change.

## Agent Maintenance Rule
- Whenever a problem is solved, document it in `AGENTS.md` with failure, root cause, and exact fix steps/commands.

## Solved Problems Log

## Post-Modification Workflow
After each modification, always commit and push changes:
```bash
git add -A && git commit -m '<description>' && git push
```
