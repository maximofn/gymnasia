# Frontend Implementation Guide (from Pencil)

## Objective
Implement web and mobile fronts using the Pencil outputs in `docs/design/` as visual source of truth.

## Design tokens source
- Shared TS tokens: `packages/shared/src/design-tokens.ts`
- Web CSS variables: `apps/web/app/theme.css`
- Mobile base theme: `apps/mobile/theme.ts`

## Current web routes
- `/`
- `/training`
- `/training/[templateId]`
- `/session/[sessionId]`
- `/diet`
- `/measurements`
- `/chat`
- `/settings`
- `/settings/byok`
- `/auth/login`
- `/auth/register`
- `/auth/forgot-password`
- `/auth/verify-email`

## Visual language to keep
- Dark premium UI.
- Neon-lime primary action/accent.
- Elevated dark cards.
- Strong typographic hierarchy.
- Rounded controls with medium-large radius.

## Navigation patterns
- Desktop: persistent left sidebar (except auth screens).
- Mobile: bottom tab bar (except auth screens).
- Auth gate: any non-auth route requires session token.

## State patterns
- Routines list includes loading/empty/error + normal state.
- Chat includes enabled/disabled state by BYOK.
- Diet and measurements support API mode + local fallback.
- Settings includes goal management + account lifecycle controls.

## Screen mapping for implementation
- Home:
  - web: `Gimnasia — Home (Desktop).png`
  - mobile: `Gimnasia — Home Screen (Mobile).png` + `Gimnasia — Home Completo (Mobile).png`
- Training list and details:
  - `GIM — Rutinas (*)`
  - `GIM — Builder Rutina (*)`
  - `GIM — Sesión Activa (*)`
- Diet:
  - `GIM — Dieta del Día (*)`
  - `GIM — Estimación IA (Mobile).png`
- Measurements:
  - `GIM — Medidas (*)`
- AI and BYOK:
  - `GIM — Chat IA (*)`
  - `GIM — Chat IA Sin API Key (Mobile).png`
  - `GIM — Ajustes BYOK (*)`
- Auth:
  - `GIM — Login (*)`
  - `GIM — Registro (*)`
  - `GIM — Recuperar Contraseña (*)`
  - `GIM — Verificar Email (*)`

## Engineering rules
- Do not replace design with generic UI kit defaults.
- Keep spacing, card density, and CTA prominence close to references.
- Keep one source for tokens and avoid ad-hoc colors in components.
- If a screen intentionally diverges, document reason and new reference in `docs/design/README.md`.

## Integration notes
- Backend base URL:
  - `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).
- Auth token storage:
  - `localStorage['gimnasia_token']`.
- Current behavior:
  - without token: access gate redirects user to auth UX (except `/auth/*`)
  - with token: API sync for workouts, diet, measurements and BYOK
  - chat IA enabled only when at least one BYOK key is active
  - home dashboard consumes aggregated real data (diet + measurements + sessions + templates)
  - web queues sync operations locally and flushes via `/sync/operations/bulk`
