# Design Reference (Pencil Outputs)

This folder is the visual source of truth for frontend implementation.

## Primary assets
- `untitled.pen`
- `Gimnasia Design System.png`
- `frontend-implementation-guide.md`
- `qa-checklist.md`

## Screen references by feature
- Home:
  - `Gimnasia — Home (Desktop).png`
  - `Gimnasia — Home Screen (Mobile).png`
  - `Gimnasia — Home Completo (Mobile).png`
- Training:
  - `GIM — Rutinas (Desktop).png`
  - `GIM — Rutinas (Mobile).png`
  - `GIM — Rutinas Cargando (Desktop).png`
  - `GIM — Rutinas Cargando (Mobile).png`
  - `GIM — Rutinas Error (Desktop).png`
  - `GIM — Rutinas Error (Mobile).png`
  - `GIM — Rutinas Vacío (Desktop).png`
  - `GIM — Rutinas Vacío (Mobile).png`
  - `GIM — Builder Rutina (Desktop).png`
  - `GIM — Builder Rutina (Mobile).png`
  - `GIM — Sesión Activa (Desktop).png`
  - `GIM — Sesión Activa (Mobile).png`
  - `GIM — Sesión Modal (Mobile).png`
  - `Gimnasia — Workout Detail (Mobile).png`
- Diet:
  - `GIM — Dieta del Día (Desktop).png`
  - `GIM — Dieta del Día (Mobile).png`
  - `GIM — Estimación IA (Mobile).png`
- Measurements:
  - `GIM — Medidas (Desktop).png`
  - `GIM — Medidas (Mobile).png`
- AI chat and BYOK:
  - `GIM — Chat IA (Desktop).png`
  - `GIM — Chat IA (Mobile).png`
  - `GIM — Chat IA Sin API Key (Mobile).png`
  - `GIM — Ajustes BYOK (Desktop).png`
  - `GIM — Ajustes BYOK (Mobile).png`
  - `GIM — Confirmar Eliminar Key (Mobile).png`
- Auth:
  - `GIM — Login (Desktop).png`
  - `GIM — Login (Mobile).png`
  - `GIM — Registro (Desktop).png`
  - `GIM — Registro (Mobile).png`
  - `GIM — Recuperar Contraseña (Desktop).png`
  - `GIM — Recuperar Contraseña (Mobile).png`
  - `GIM — Verificar Email (Desktop).png`
  - `GIM — Verificar Email (Mobile).png`

## Frontend implementation constraints
- Keep dark premium visual language from Pencil outputs:
  - dark background, elevated dark surfaces, neon-lime primary accent.
- Keep interaction patterns:
  - desktop left sidebar navigation.
  - mobile bottom tab navigation.
  - card-heavy layouts with clear hierarchy and large CTA.
- Keep component states visible:
  - loading, empty, error variants for routines.
  - disabled AI state when BYOK is not configured.
- Keep training UX behavior visible:
  - inline set editing.
  - finish-session confirmation modal.
- Keep auth screens stylistically consistent with main app (no visual reset).

## Route-to-design mapping (target)
- `/` -> Home
- `/training` -> Rutinas
- `/training/:id` -> Builder Rutina
- `/session/:id` -> Sesion Activa
- `/diet` -> Dieta del Dia
- `/measurements` -> Medidas
- `/chat` -> Chat IA
- `/settings/byok` -> Ajustes BYOK
- `/auth/*` -> Login/Registro/Recuperar/Verificar

## Notes
- `images/generated-*.png` are auxiliary generated assets. Do not use them as primary UI references unless explicitly needed for content placeholders.
- If a new frontend change diverges from these references, update this file and attach the new design source.
