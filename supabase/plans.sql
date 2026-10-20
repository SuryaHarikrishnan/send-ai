-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once. Adds workout plans (one per person) so a plan follows you to any device.
-- Until this is run, plans are kept on the phone they were made on.

create table if not exists public.workout_plans (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- { "profile": { goal, level, heightIn, weightLb, intensity, days, minutes }, "days": [{ "name", "exercises": [{ "name", "sets", "reps": [lo, hi], "start" }] }] }
  plan jsonb not null,
  updated_at timestamptz not null default now()
);

-- Each person can only see and change their own plan.
alter table public.workout_plans enable row level security;

drop policy if exists "Own plan: read" on public.workout_plans;
drop policy if exists "Own plan: add" on public.workout_plans;
drop policy if exists "Own plan: edit" on public.workout_plans;
drop policy if exists "Own plan: delete" on public.workout_plans;

create policy "Own plan: read" on public.workout_plans
  for select to authenticated using (auth.uid() = user_id);
create policy "Own plan: add" on public.workout_plans
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own plan: edit" on public.workout_plans
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own plan: delete" on public.workout_plans
  for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.workout_plans to authenticated;

-- Make the API notice the new table right away.
notify pgrst, 'reload schema';

-- Check: should show workout_plans with rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'workout_plans';
