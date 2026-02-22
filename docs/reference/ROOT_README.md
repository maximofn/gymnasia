# Gimnasia Monorepo

## Documentacion
- Documentacion central del proyecto: `docs/README.md`

## Estructura
- `apps/api`: backend FastAPI
- `apps/web`: frontend Next.js
- `apps/mobile`: frontend Expo React Native
- `packages/shared`: tipos compartidos TypeScript
- `supabase/migrations`: SQL de migraciones

## Arranque rapido
1. Configura variables de entorno en `apps/api/.env` usando `apps/api/.env.example`.
2. Levanta backend:
   - `cd apps/api`
   - `python -m venv .venv && source .venv/bin/activate`
   - `pip install -r requirements.txt`
   - `uvicorn app.main:app --reload`
3. Levanta web:
   - `npm install`
   - `npm run dev:web`
4. Levanta mobile:
   - `npm run dev:mobile`
