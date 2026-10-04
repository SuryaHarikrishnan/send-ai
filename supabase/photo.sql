-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once. Counts meal photos so /api/food-photo can allow 3 a day.
-- No update or delete policy, so people can't reset their own count.
create table if not exists public.food_photo_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists food_photo_requests_user_day on public.food_photo_requests (user_id, created_at);

alter table public.food_photo_requests enable row level security;

drop policy if exists "Own photo requests: read" on public.food_photo_requests;
drop policy if exists "Own photo requests: add" on public.food_photo_requests;

create policy "Own photo requests: read" on public.food_photo_requests
  for select to authenticated using (auth.uid() = user_id);
create policy "Own photo requests: add" on public.food_photo_requests
  for insert to authenticated with check (auth.uid() = user_id);

grant select, insert on public.food_photo_requests to authenticated;
notify pgrst, 'reload schema';

-- Check: should list food_photo_requests with rowsecurity = true.
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'food_photo_requests';
