# Gymnasia

Monorepo local para una app de gimnasio con entrenamiento, dieta, medidas y chat IA por seccion.

## Stack

- Web: `Next.js`
- Mobile: `Expo React Native`
- API: `FastAPI`
- DB/Auth/Storage: `Supabase`

## Estructura

- `apps/api`: backend por dominios (`training`, `diet`, `measures`, `chat`, `media`).
- `apps/web`: frontend web.
- `apps/mobile`: frontend mobile.
- `packages/shared`: tipos compartidos.
- `infra/supabase/schema.sql`: esquema SQL completo + RLS + retencion.

## Funcionalidad implementada

- Entrenamiento:
  - CRUD de plantillas y biblioteca de ejercicios.
  - Clonacion y reordenado.
  - Sesiones realizadas con cierre y opcion `actualizar plantilla` o `guardar solo hoy`.
  - PRs basicos.
- Dieta:
  - Dieta diaria, comidas, entradas.
  - Alimentos manuales.
  - Recetas y escalado por raciones.
  - Resumen de macros/calorias.
- Medidas:
  - Registro de peso y contornos.
  - Fotos de progreso (metadatos).
- Chat:
  - Hilos por seccion.
  - Mensajes y flujo base de audio->texto.
- Media:
  - Assets y solicitudes de generacion (`google_nano_banana`, `veo3` como hook).

## Inicio rapido local

1. Copia variables:
   - `apps/api/.env.example` -> `apps/api/.env`
   - `apps/web/.env.example` -> `apps/web/.env.local`
   - `apps/mobile/.env.example` -> `apps/mobile/.env`
   - Define el mismo UUID real de usuario en:
     - `apps/api/.env` -> `DEFAULT_DEV_USER_ID`
     - `apps/web/.env.local` -> `NEXT_PUBLIC_DEV_USER_ID`
     - `apps/mobile/.env` -> `EXPO_PUBLIC_DEV_USER_ID`
2. Crea esquema en Supabase ejecutando `infra/supabase/schema.sql`.
3. Instala dependencias API:
   - `uv sync --project apps/api`
4. Instala dependencias JS:
   - `pnpm install`
5. Arranque unico (recomendado):
   - `make dev`
   - (equivalente: `./scripts/dev-all.sh`)
6. Arranque manual por servicio:
   - API:
   - `cd /Users/macm1/Documents/proyectos/gymnasia`
   - `uv run --project apps/api --no-sync uvicorn app.main:app --reload --app-dir apps/api`
   - Web:
     - `pnpm --filter web dev`
   - Mobile:
     - `pnpm --filter mobile start`

## Notas

- RLS esta activado y definido por `user_id = auth.uid()` en SQL.
- Retencion inicial de 6 meses en `public.purge_old_user_data()`.
- Integraciones de LangGraph/Whisper/Nano Banana/Veo3 estan preparadas como hooks para conectar tus agentes.
