-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once. Adds the lifting workouts table.

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Workout',
  performed_at timestamptz not null default now(),
  duration_min integer,
  -- [{ "name": "Bench press", "sets": [{ "reps": 8, "weight": 165 }, ...] }, ...]
  exercises jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists workouts_user_date on public.workouts (user_id, performed_at desc);

-- Each person can only see and change their own workouts.
alter table public.workouts enable row level security;

drop policy if exists "Own workouts: read" on public.workouts;
drop policy if exists "Own workouts: add" on public.workouts;
drop policy if exists "Own workouts: edit" on public.workouts;
drop policy if exists "Own workouts: delete" on public.workouts;

create policy "Own workouts: read" on public.workouts
  for select to authenticated using (auth.uid() = user_id);
create policy "Own workouts: add" on public.workouts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own workouts: edit" on public.workouts
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own workouts: delete" on public.workouts
  for delete to authenticated using (auth.uid() = user_id);

-- Check: should show workouts with rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'workouts';
