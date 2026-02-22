# Backend - Modelo de Datos

## Modelo implementado (fase 1 a fase 6)
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
- `media_assets`
- `diet_item_estimates`
- `exercise_media_links`
- `background_jobs`
- `chat_threads`
- `chat_messages`
- `agent_memory_entries`
- `sync_operations`
- `data_export_requests`

## Enums implementados
- `account_status_enum`
- `ai_provider_enum`
- `goal_domain_enum`
- `workout_session_status_enum`
- `meal_type_enum`
- `media_kind_enum`
- `media_status_enum`
- `chat_role_enum`
- `memory_domain_enum`
- `job_type_enum`
- `job_status_enum`
- `sync_op_type_enum`
- `sync_status_enum`

## Constraints relevantes
- Un solo objetivo activo por usuario:
  - indice parcial unico `ux_goals_single_active_per_user`.
- Reps de series:
  - modo fijo o rango exclusivo (check constraint).
- Descanso:
  - formato `mm:ss` validado por regex en DB.
- Dieta diaria:
  - unico por usuario y fecha (`uq_diet_days_user_date`).

## Referencia de esquema completo
- `docs/reference/DATABASE_SCHEMA_V1.sql` mantiene la referencia extendida v1.
- Alembic ahora cubre los dominios principales del esquema v1 en runtime.
