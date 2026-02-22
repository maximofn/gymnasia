-- Gym App V1 - PostgreSQL schema (Supabase-compatible)

create extension if not exists pgcrypto;

-- Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status_enum') then
    create type account_status_enum as enum ('active', 'pending_delete');
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_provider_enum') then
    create type ai_provider_enum as enum ('anthropic', 'openai', 'google');
  end if;
  if not exists (select 1 from pg_type where typname = 'goal_domain_enum') then
    create type goal_domain_enum as enum ('training', 'diet', 'body', 'wellness');
  end if;
  if not exists (select 1 from pg_type where typname = 'meal_type_enum') then
    create type meal_type_enum as enum ('breakfast', 'lunch', 'snack', 'dinner', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'media_kind_enum') then
    create type media_kind_enum as enum (
      'exercise_machine',
      'exercise_instruction_image',
      'exercise_instruction_video',
      'body_progress',
      'diet_plate',
      'diet_label',
      'diet_menu',
      'recipe',
      'other'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'media_status_enum') then
    create type media_status_enum as enum ('uploaded', 'processing', 'ready', 'failed', 'deleted');
  end if;
  if not exists (select 1 from pg_type where typname = 'workout_session_status_enum') then
    create type workout_session_status_enum as enum ('in_progress', 'finished');
  end if;
  if not exists (select 1 from pg_type where typname = 'chat_role_enum') then
    create type chat_role_enum as enum ('system', 'user', 'assistant');
  end if;
  if not exists (select 1 from pg_type where typname = 'memory_domain_enum') then
    create type memory_domain_enum as enum ('global', 'training', 'diet', 'measurements');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_type_enum') then
    create type job_type_enum as enum ('diet_photo_estimate', 'exercise_image_generation', 'exercise_video_generation');
  end if;
  if not exists (select 1 from pg_type where typname = 'job_status_enum') then
    create type job_status_enum as enum ('queued', 'running', 'done', 'failed', 'canceled');
  end if;
  if not exists (select 1 from pg_type where typname = 'sync_op_type_enum') then
    create type sync_op_type_enum as enum ('upsert', 'delete');
  end if;
  if not exists (select 1 from pg_type where typname = 'sync_status_enum') then
    create type sync_status_enum as enum ('pending', 'applied', 'failed');
  end if;
end $$;

-- Users and account lifecycle
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  email_verified_at timestamptz,
  country_code char(2) not null default 'ES',
  birth_date date,
  account_status account_status_enum not null default 'active',
  delete_requested_at timestamptz,
  scheduled_delete_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_profiles (
  user_id uuid primary key references users(id) on delete cascade,
  display_name text,
  height_cm numeric(5,2),
  unit_system text not null default 'metric',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_ai_settings (
  user_id uuid primary key references users(id) on delete cascade,
  monthly_limit_eur numeric(10,2),
  warn_percent integer not null default 80 check (warn_percent between 1 and 100),
  hard_block_on_limit boolean not null default false,
  chat_rate_limit_per_min integer not null default 10 check (chat_rate_limit_per_min > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists api_provider_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider ai_provider_enum not null,
  key_ciphertext text not null,
  key_fingerprint text not null,
  is_active boolean not null default true,
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

-- Goals
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text not null,
  domain goal_domain_enum not null,
  target_value numeric(12,3),
  target_unit text,
  start_date date not null default current_date,
  end_date date,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ux_goals_single_active_per_user
on goals (user_id) where is_active = true;

-- Exercise catalog and custom exercises
create table if not exists exercise_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  muscle_group text not null,
  equipment text,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, muscle_group)
);

create table if not exists exercise_user_custom (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text,
  instructions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_exercise_user_custom_user on exercise_user_custom(user_id);

-- Workout templates
create table if not exists workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  notes text,
  position integer not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_workout_templates_user_position on workout_templates(user_id, position);

create table if not exists workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_template_id uuid not null references workout_templates(id) on delete cascade,
  position integer not null default 0,
  exercise_catalog_id uuid references exercise_catalog(id),
  exercise_user_custom_id uuid references exercise_user_custom(id),
  exercise_name_snapshot text not null,
  muscle_group_snapshot text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (exercise_catalog_id is not null and exercise_user_custom_id is null)
    or
    (exercise_catalog_id is null and exercise_user_custom_id is not null)
  )
);

create index if not exists ix_workout_template_exercises_template_position
on workout_template_exercises(workout_template_id, position);

create table if not exists workout_template_sets (
  id uuid primary key default gen_random_uuid(),
  template_exercise_id uuid not null references workout_template_exercises(id) on delete cascade,
  position integer not null default 0,
  reps_fixed integer,
  reps_min integer,
  reps_max integer,
  rest_mmss text not null,
  weight_kg numeric(8,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (reps_fixed is not null and reps_min is null and reps_max is null)
    or
    (reps_fixed is null and reps_min is not null and reps_max is not null and reps_min <= reps_max)
  ),
  check (rest_mmss ~ '^[0-5][0-9]:[0-5][0-9]$')
);

create index if not exists ix_workout_template_sets_exercise_position
on workout_template_sets(template_exercise_id, position);

-- Workout sessions (historical snapshot)
create table if not exists workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  template_id uuid references workout_templates(id) on delete set null,
  status workout_session_status_enum not null default 'in_progress',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text,
  applied_changes_to_template boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_workout_sessions_user_started on workout_sessions(user_id, started_at desc);

create table if not exists workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_session_id uuid not null references workout_sessions(id) on delete cascade,
  source_template_exercise_id uuid references workout_template_exercises(id) on delete set null,
  position integer not null default 0,
  exercise_catalog_id uuid references exercise_catalog(id),
  exercise_user_custom_id uuid references exercise_user_custom(id),
  exercise_name_snapshot text not null,
  muscle_group_snapshot text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (exercise_catalog_id is not null and exercise_user_custom_id is null)
    or
    (exercise_catalog_id is null and exercise_user_custom_id is not null)
  )
);

create index if not exists ix_workout_session_exercises_session_position
on workout_session_exercises(workout_session_id, position);

create table if not exists workout_session_sets (
  id uuid primary key default gen_random_uuid(),
  session_exercise_id uuid not null references workout_session_exercises(id) on delete cascade,
  source_template_set_id uuid references workout_template_sets(id) on delete set null,
  position integer not null default 0,
  reps_fixed integer,
  reps_min integer,
  reps_max integer,
  rest_mmss text not null,
  weight_kg numeric(8,2),
  inherited_from_last_session boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (reps_fixed is not null and reps_min is null and reps_max is null)
    or
    (reps_fixed is null and reps_min is not null and reps_max is not null and reps_min <= reps_max)
  ),
  check (rest_mmss ~ '^[0-5][0-9]:[0-5][0-9]$')
);

create index if not exists ix_workout_session_sets_exercise_position
on workout_session_sets(session_exercise_id, position);

-- Diet
create table if not exists diet_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  day_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_date)
);

create table if not exists diet_meals (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references diet_days(id) on delete cascade,
  meal_type meal_type_enum not null,
  title text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_diet_meals_day_position on diet_meals(day_id, position);

create table if not exists diet_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references diet_meals(id) on delete cascade,
  name text not null,
  grams numeric(10,2),
  serving_count numeric(10,3),
  calories_kcal numeric(10,2),
  protein_g numeric(10,2),
  carbs_g numeric(10,2),
  fat_g numeric(10,2),
  calories_protein_kcal numeric(10,2),
  calories_carbs_kcal numeric(10,2),
  calories_fat_kcal numeric(10,2),
  created_by_ai boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_diet_items_meal on diet_items(meal_id);

-- Media assets and jobs
create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  kind media_kind_enum not null,
  status media_status_enum not null default 'uploaded',
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  retention_delete_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

create index if not exists ix_media_assets_user_kind on media_assets(user_id, kind);

create table if not exists diet_item_estimates (
  id uuid primary key default gen_random_uuid(),
  diet_item_id uuid not null references diet_items(id) on delete cascade,
  media_asset_id uuid not null references media_assets(id) on delete cascade,
  provider ai_provider_enum not null,
  confidence_percent numeric(5,2) check (confidence_percent >= 0 and confidence_percent <= 100),
  estimate_payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ix_diet_item_estimates_item on diet_item_estimates(diet_item_id);

create table if not exists exercise_media_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  exercise_catalog_id uuid references exercise_catalog(id),
  exercise_user_custom_id uuid references exercise_user_custom(id),
  machine_photo_asset_id uuid references media_assets(id),
  generated_image_asset_id uuid references media_assets(id),
  generated_video_asset_id uuid references media_assets(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (exercise_catalog_id is not null and exercise_user_custom_id is null)
    or
    (exercise_catalog_id is null and exercise_user_custom_id is not null)
  )
);

create table if not exists background_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type job_type_enum not null,
  status job_status_enum not null default 'queued',
  payload jsonb not null,
  result jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_background_jobs_status_run_after on background_jobs(status, run_after);

-- Body measurements
create table if not exists body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(8,3),
  circumferences_cm jsonb not null default '{}'::jsonb,
  notes text,
  photo_asset_id uuid references media_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_body_measurements_user_measured_at
on body_measurements(user_id, measured_at desc);

-- Chat and memory
create table if not exists chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_chat_threads_user on chat_threads(user_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references chat_threads(id) on delete cascade,
  role chat_role_enum not null,
  content text not null,
  provider ai_provider_enum,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  safety_flags jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ix_chat_messages_thread_created on chat_messages(thread_id, created_at);

create table if not exists agent_memory_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  domain memory_domain_enum not null,
  memory_key text not null,
  memory_value jsonb not null,
  source_chat_message_id uuid references chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists ux_agent_memory_user_domain_key_active
on agent_memory_entries(user_id, domain, memory_key)
where deleted_at is null;

-- Sync operations log / queue
create table if not exists sync_operations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  device_id text not null,
  entity_type text not null,
  entity_id uuid,
  op_type sync_op_type_enum not null,
  payload jsonb,
  client_updated_at timestamptz not null,
  server_received_at timestamptz not null default now(),
  status sync_status_enum not null default 'pending',
  retries integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_sync_ops_user_status_created
on sync_operations(user_id, status, created_at);

-- Optional data export requests
create table if not exists data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  status text not null default 'requested',
  export_path text,
  requested_at timestamptz not null default now(),
  fulfilled_at timestamptz
);
