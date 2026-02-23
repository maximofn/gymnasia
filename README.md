# Gimnasia Monorepo

## Documentacion
- Documentacion central del proyecto: `docs/README.md`
- Referencia de diseno frontend: `docs/design/README.md`

## Estructura
- `apps/api`: backend FastAPI
- `apps/web`: frontend Next.js
- `apps/mobile`: frontend Expo React Native
- `packages/shared`: tipos compartidos TypeScript
- `supabase/migrations`: SQL de migraciones

## Enfoque actual (2026-02-22)
- Desarrollo centrado en `apps/mobile`.
- La app movil funciona en modo local y persiste en el dispositivo.
- No hay llamadas obligatorias al backend ni dependencia activa de Supabase para la experiencia base.

## Arranque rapido
1. Instala dependencias:
   - `npm install`
2. Levanta mobile:
   - `npm run dev:mobile`
3. Type-check mobile:
   - `npm --workspace apps/mobile exec tsc --noEmit`

Notas:
- `apps/api`, `apps/web` y `supabase/migrations` permanecen en el repo como referencia/evolucion futura.
