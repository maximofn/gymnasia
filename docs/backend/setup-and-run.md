# Backend - Setup y Ejecucion

## Requisitos
- Python 3.11+
- Postgres (Supabase o local)

## Setup local
1. `cd apps/api`
2. `python3 -m venv .venv`
3. `source .venv/bin/activate`
4. `pip install -r requirements.txt`
5. `cp .env.example .env`
6. Ajustar variables en `.env`:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `APP_ENCRYPTION_KEY`
   - `INTERNAL_ADMIN_TOKEN` (para jobs internos de lifecycle de cuenta)

## Ejecutar API
- `uvicorn app.main:app --reload`

## Migraciones
- Aplicar:
  - `alembic upgrade head`
- Versiones actuales:
  - `20260220_0001`: auth + BYOK base
  - `20260220_0002`: tracking (goals/workouts/diet/measurements)
  - `20260221_0003`: chat/memory/media/sync/account lifecycle

## Healthcheck
- `GET /health`
