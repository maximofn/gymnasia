# V1 Data Spec

## 1. Entidades implementadas
- `users`
- `user_ai_settings`
- `api_provider_keys`
- `goals`
- `workout_templates`
- `workout_template_exercises`
- `workout_template_sets`
- `workout_sessions`
- `workout_session_exercises`
- `workout_session_sets`
- `diet_days`
- `diet_meals`
- `diet_items`
- `body_measurements`

## 2. Reglas clave de datos
- Objetivo activo unico por usuario:
  - indice parcial unico `ux_goals_single_active_per_user`.
- Series:
  - `reps_fixed` o (`reps_min` + `reps_max`) de forma exclusiva.
  - `rest_mmss` validado por regex `mm:ss`.
- Dieta diaria:
  - una fila por usuario y fecha.

## 3. Integridad referencial
- Uso extensivo de `ON DELETE CASCADE` para datos hijos.
- Uso de `ON DELETE SET NULL` en referencias historicas de sesiones a plantillas.

## 4. Extensiones planificadas de esquema
- Media assets y jobs async.
- Chat threads/messages.
- Memoria del agente.
- Sync operations.
- Export requests.

Referencia de esquema extendido:
- `docs/reference/DATABASE_SCHEMA_V1.sql`
