# Backend - Migraciones

## Estrategia
- Alembic como sistema de migraciones.
- Migraciones incrementales por fase de producto.
- `Base.metadata.create_all` se mantiene para desarrollo rapido local, pero en entornos reales debe priorizarse `alembic upgrade head`.

## Migraciones actuales
1. `20260220_0001_phase1_auth_byok.py`
   - Crea `users`, `user_ai_settings`, `api_provider_keys`.
   - Crea enums base de auth/BYOK.
2. `20260220_0002_phase2_tracking.py`
   - Crea tablas de goals, workouts, dieta y medidas.
   - Crea enums y constraints asociados.
3. `20260221_0003_phase3_to_phase6.py`
   - Crea tablas/enums de chat, memoria, media, jobs, sync y export.
   - Extiende `body_measurements` con `photo_asset_id`.
   - Habilita endpoints de lifecycle de cuenta y operaciones de sync.

## Recomendaciones operativas
- Nunca editar migraciones ya aplicadas en produccion.
- Agregar una migracion nueva para cada cambio de esquema.
- Probar downgrade en staging antes de cambios riesgosos.
