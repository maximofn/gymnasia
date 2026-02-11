-- Gymnasia schema for Supabase Postgres
-- Date: 2026-02-11

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (section in ('training', 'diet', 'measures', 'general')),
  objective text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text not null,
  equipment text not null default 'other',
  instructions text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  position int not null default 0,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.training_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.training_plans(id) on delete cascade,
  exercise_id uuid not null references public.exercise_library(id) on delete restrict,
  position int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.training_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_exercise_id uuid not null references public.training_plan_exercises(id) on delete cascade,
  position int not null default 0,
  reps int not null,
  rest_seconds int not null,
  weight_kg numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.training_plans(id) on delete set null,
  plan_version_at_start int,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  should_update_template boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  source_plan_exercise_id uuid references public.training_plan_exercises(id) on delete set null,
  exercise_id uuid not null references public.exercise_library(id) on delete restrict,
  position int not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_session_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_exercise_id uuid not null references public.training_session_exercises(id) on delete cascade,
  position int not null default 0,
  reps int not null,
  rest_seconds int not null,
  weight_kg numeric(6,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  record_type text not null,
  value numeric(10,2) not null,
  session_set_id uuid not null references public.training_session_sets(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  unit text not null default 'g',
  protein_per_100g numeric(7,2) not null default 0,
  carbs_per_100g numeric(7,2) not null default 0,
  fats_per_100g numeric(7,2) not null default 0,
  calories_per_100g numeric(7,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  instructions text,
  servings int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  food_item_id uuid not null references public.food_items(id) on delete restrict,
  grams numeric(8,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.daily_diets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  diet_date date not null,
  name text not null,
  phase text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  daily_diet_id uuid not null references public.daily_diets(id) on delete cascade,
  meal_type text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_id uuid not null references public.meals(id) on delete cascade,
  entry_type text not null check (entry_type in ('food', 'recipe', 'custom')),
  food_item_id uuid references public.food_items(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete set null,
  custom_name text,
  grams numeric(8,2) not null,
  servings numeric(7,2) not null default 1,
  protein_g numeric(8,2) not null default 0,
  carbs_g numeric(8,2) not null default 0,
  fats_g numeric(8,2) not null default 0,
  calories numeric(8,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null,
  weight_kg numeric(6,2),
  body_fat_pct numeric(5,2),
  waist_cm numeric(6,2),
  hip_cm numeric(6,2),
  chest_cm numeric(6,2),
  arm_cm numeric(6,2),
  thigh_cm numeric(6,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null,
  photo_type text not null default 'other',
  storage_path text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (section in ('training', 'diet', 'measures', 'general')),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  audio_path text,
  provider text,
  model text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  storage_path text not null,
  mime_type text not null,
  generator text not null default 'manual',
  generation_prompt text,
  status text not null default 'completed',
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.domain_events (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  domain text not null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_training_plans_user_position on public.training_plans(user_id, position) where deleted_at is null;
create index if not exists idx_training_plan_exercises_plan_position on public.training_plan_exercises(plan_id, position) where deleted_at is null;
create index if not exists idx_training_sets_plan_exercise_position on public.training_sets(plan_exercise_id, position) where deleted_at is null;
create index if not exists idx_training_sessions_user_started_at on public.training_sessions(user_id, started_at desc);
create index if not exists idx_exercise_library_search on public.exercise_library(user_id, lower(name), muscle_group) where deleted_at is null;
create index if not exists idx_daily_diets_user_date on public.daily_diets(user_id, diet_date desc) where deleted_at is null;
create index if not exists idx_body_measurements_user_date on public.body_measurements(user_id, measured_at desc) where deleted_at is null;
create index if not exists idx_chat_threads_user_section on public.chat_threads(user_id, section) where deleted_at is null;
create index if not exists idx_chat_messages_thread_created on public.chat_messages(thread_id, created_at asc);
create index if not exists idx_media_assets_user_created on public.media_assets(user_id, created_at desc) where deleted_at is null;
create index if not exists idx_domain_events_user_created on public.domain_events(user_id, created_at desc);

-- Updated_at triggers
drop trigger if exists trg_user_goals_updated on public.user_goals;
drop trigger if exists trg_exercise_library_updated on public.exercise_library;
drop trigger if exists trg_training_plans_updated on public.training_plans;
drop trigger if exists trg_training_plan_exercises_updated on public.training_plan_exercises;
drop trigger if exists trg_training_sets_updated on public.training_sets;
drop trigger if exists trg_training_sessions_updated on public.training_sessions;
drop trigger if exists trg_training_session_exercises_updated on public.training_session_exercises;
drop trigger if exists trg_training_session_sets_updated on public.training_session_sets;
drop trigger if exists trg_personal_records_updated on public.personal_records;
drop trigger if exists trg_food_items_updated on public.food_items;
drop trigger if exists trg_recipes_updated on public.recipes;
drop trigger if exists trg_recipe_items_updated on public.recipe_items;
drop trigger if exists trg_daily_diets_updated on public.daily_diets;
drop trigger if exists trg_meals_updated on public.meals;
drop trigger if exists trg_meal_entries_updated on public.meal_entries;
drop trigger if exists trg_body_measurements_updated on public.body_measurements;
drop trigger if exists trg_progress_photos_updated on public.progress_photos;
drop trigger if exists trg_chat_threads_updated on public.chat_threads;
drop trigger if exists trg_chat_messages_updated on public.chat_messages;
drop trigger if exists trg_media_assets_updated on public.media_assets;

create trigger trg_user_goals_updated before update on public.user_goals for each row execute function public.set_updated_at();
create trigger trg_exercise_library_updated before update on public.exercise_library for each row execute function public.set_updated_at();
create trigger trg_training_plans_updated before update on public.training_plans for each row execute function public.set_updated_at();
create trigger trg_training_plan_exercises_updated before update on public.training_plan_exercises for each row execute function public.set_updated_at();
create trigger trg_training_sets_updated before update on public.training_sets for each row execute function public.set_updated_at();
create trigger trg_training_sessions_updated before update on public.training_sessions for each row execute function public.set_updated_at();
create trigger trg_training_session_exercises_updated before update on public.training_session_exercises for each row execute function public.set_updated_at();
create trigger trg_training_session_sets_updated before update on public.training_session_sets for each row execute function public.set_updated_at();
create trigger trg_personal_records_updated before update on public.personal_records for each row execute function public.set_updated_at();
create trigger trg_food_items_updated before update on public.food_items for each row execute function public.set_updated_at();
create trigger trg_recipes_updated before update on public.recipes for each row execute function public.set_updated_at();
create trigger trg_recipe_items_updated before update on public.recipe_items for each row execute function public.set_updated_at();
create trigger trg_daily_diets_updated before update on public.daily_diets for each row execute function public.set_updated_at();
create trigger trg_meals_updated before update on public.meals for each row execute function public.set_updated_at();
create trigger trg_meal_entries_updated before update on public.meal_entries for each row execute function public.set_updated_at();
create trigger trg_body_measurements_updated before update on public.body_measurements for each row execute function public.set_updated_at();
create trigger trg_progress_photos_updated before update on public.progress_photos for each row execute function public.set_updated_at();
create trigger trg_chat_threads_updated before update on public.chat_threads for each row execute function public.set_updated_at();
create trigger trg_chat_messages_updated before update on public.chat_messages for each row execute function public.set_updated_at();
create trigger trg_media_assets_updated before update on public.media_assets for each row execute function public.set_updated_at();

-- RLS
alter table public.user_goals enable row level security;
alter table public.exercise_library enable row level security;
alter table public.training_plans enable row level security;
alter table public.training_plan_exercises enable row level security;
alter table public.training_sets enable row level security;
alter table public.training_sessions enable row level security;
alter table public.training_session_exercises enable row level security;
alter table public.training_session_sets enable row level security;
alter table public.personal_records enable row level security;
alter table public.food_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_items enable row level security;
alter table public.daily_diets enable row level security;
alter table public.meals enable row level security;
alter table public.meal_entries enable row level security;
alter table public.body_measurements enable row level security;
alter table public.progress_photos enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.media_assets enable row level security;
alter table public.domain_events enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.apply_rls_policy(table_name text)
returns void
language plpgsql
as $$
begin
  execute format('drop policy if exists %I_user_policy on public.%I', table_name, table_name);
  execute format(
    'create policy %I_user_policy on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
    table_name,
    table_name
  );
end;
$$;

select public.apply_rls_policy('user_goals');
select public.apply_rls_policy('exercise_library');
select public.apply_rls_policy('training_plans');
select public.apply_rls_policy('training_plan_exercises');
select public.apply_rls_policy('training_sets');
select public.apply_rls_policy('training_sessions');
select public.apply_rls_policy('training_session_exercises');
select public.apply_rls_policy('training_session_sets');
select public.apply_rls_policy('personal_records');
select public.apply_rls_policy('food_items');
select public.apply_rls_policy('recipes');
select public.apply_rls_policy('recipe_items');
select public.apply_rls_policy('daily_diets');
select public.apply_rls_policy('meals');
select public.apply_rls_policy('meal_entries');
select public.apply_rls_policy('body_measurements');
select public.apply_rls_policy('progress_photos');
select public.apply_rls_policy('chat_threads');
select public.apply_rls_policy('chat_messages');
select public.apply_rls_policy('media_assets');
select public.apply_rls_policy('domain_events');
select public.apply_rls_policy('audit_logs');

-- Retention 6 months
create or replace function public.purge_old_user_data()
returns void
language plpgsql
security definer
as $$
begin
  update public.training_plans set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';
  update public.exercise_library set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';
  update public.food_items set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';
  update public.recipes set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';
  update public.daily_diets set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';
  update public.body_measurements set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';
  update public.progress_photos set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';
  update public.chat_threads set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';
  update public.media_assets set deleted_at = now() where deleted_at is null and created_at < now() - interval '6 months';

  delete from public.chat_messages where created_at < now() - interval '6 months';
  delete from public.domain_events where created_at < now() - interval '6 months';
  delete from public.audit_logs where created_at < now() - interval '6 months';
end;
$$;

-- Optional: if pg_cron is available in your project
-- select cron.schedule('purge-old-user-data', '0 3 * * *', $$select public.purge_old_user_data();$$);
