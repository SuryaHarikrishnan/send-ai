-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once. Adds the food log table.

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal text not null default 'snack' check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  name text not null,
  brand text,
  barcode text,
  -- 'off' (Open Food Facts), 'common' (built-in list) or 'custom' (typed in)
  source text not null default 'custom',
  amount numeric not null default 1,
  -- id of the unit in food.units, e.g. 'serving', 'g', 'oz'
  unit text not null default 'serving',
  grams numeric,
  kcal numeric not null default 0,
  protein_g numeric not null default 0,
  carbs_g numeric not null default 0,
  fat_g numeric not null default 0,
  -- nutrition per 100 g / per serving and the units, so the food can be logged again
  food jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists food_logs_user_date on public.food_logs (user_id, eaten_at desc);

-- Each person can only see and change their own food log.
alter table public.food_logs enable row level security;

drop policy if exists "Own food: read" on public.food_logs;
drop policy if exists "Own food: add" on public.food_logs;
drop policy if exists "Own food: edit" on public.food_logs;
drop policy if exists "Own food: delete" on public.food_logs;

create policy "Own food: read" on public.food_logs
  for select to authenticated using (auth.uid() = user_id);
create policy "Own food: add" on public.food_logs
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own food: edit" on public.food_logs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own food: delete" on public.food_logs
  for delete to authenticated using (auth.uid() = user_id);

-- Let signed-in users reach the table (RLS above still limits them to their own rows).
grant select, insert, update, delete on public.food_logs to authenticated;

-- Make the API notice the new table right away.
notify pgrst, 'reload schema';

-- Check: should show food_logs with rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'food_logs';
