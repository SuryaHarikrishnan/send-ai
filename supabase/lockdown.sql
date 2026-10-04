-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once.

-- 1. Climbs: each person can only see and change their own rows.
alter table public.climbs enable row level security;

drop policy if exists "Own climbs: read" on public.climbs;
drop policy if exists "Own climbs: add" on public.climbs;
drop policy if exists "Own climbs: edit" on public.climbs;
drop policy if exists "Own climbs: delete" on public.climbs;

create policy "Own climbs: read" on public.climbs
  for select to authenticated using (auth.uid() = user_id);
create policy "Own climbs: add" on public.climbs
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own climbs: edit" on public.climbs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Own climbs: delete" on public.climbs
  for delete to authenticated using (auth.uid() = user_id);

-- 2. Coach usage log, used by /api/coach to cap questions per day.
-- No update or delete policy, so people can't reset their own count.
create table if not exists public.coach_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists coach_requests_user_day on public.coach_requests (user_id, created_at);

alter table public.coach_requests enable row level security;

drop policy if exists "Own coach requests: read" on public.coach_requests;
drop policy if exists "Own coach requests: add" on public.coach_requests;

create policy "Own coach requests: read" on public.coach_requests
  for select to authenticated using (auth.uid() = user_id);
create policy "Own coach requests: add" on public.coach_requests
  for insert to authenticated with check (auth.uid() = user_id);

-- Check: should list climbs and coach_requests with rowsecurity = true.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('climbs', 'coach_requests');
