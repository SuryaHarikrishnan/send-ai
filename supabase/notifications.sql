-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once (run it again after updates to pick up new columns).
-- Adds push notification settings and the phones/browsers
-- that receive them. /api/notify (run every hour) reads these to send reminders.

-- 1. One row per person: which reminders they want and when. Reminders go to every
--    phone or browser in push_subscriptions for that person.
create table if not exists public.notify_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  -- "Time to train" on the chosen days, when nothing is logged yet that day.
  daily boolean not null default true,
  -- Days of the week for the daily reminder, 0 = Sunday ... 6 = Saturday.
  days smallint[] not null default '{0,1,2,3,4,5,6}',
  -- Hour of the day (0-23, in tz) when reminders go out.
  hour smallint not null default 18 check (hour between 0 and 23),
  -- Weekly streak about to break, or just broken.
  streak boolean not null default true,
  -- A nudge after 3, 7, 14 and 30 days without logging anything.
  comeback boolean not null default true,
  -- The weekly workout goal from Lifting Home, so the server knows what a streak is.
  week_goal smallint not null default 3 check (week_goal between 1 and 7),
  tz text not null default 'UTC',
  -- The last day (in tz) a reminder went out, so nobody gets two in one day.
  last_sent date,
  updated_at timestamptz not null default now()
);

alter table public.notify_settings enable row level security;

drop policy if exists "Own notify settings: read" on public.notify_settings;
drop policy if exists "Own notify settings: add" on public.notify_settings;
drop policy if exists "Own notify settings: edit" on public.notify_settings;

create policy "Own notify settings: read" on public.notify_settings
  for select to authenticated using (auth.uid() = user_id);
create policy "Own notify settings: add" on public.notify_settings
  for insert to authenticated with check (auth.uid() = user_id);
create policy "Own notify settings: edit" on public.notify_settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.notify_settings to authenticated;

-- 2. Each phone or browser that turned notifications on. A browser belongs to whoever
--    turned them on last, so the app saves it through save_push_subscription() below.
create table if not exists public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Own push subscriptions: read" on public.push_subscriptions;
drop policy if exists "Own push subscriptions: delete" on public.push_subscriptions;

create policy "Own push subscriptions: read" on public.push_subscriptions
  for select to authenticated using (auth.uid() = user_id);
create policy "Own push subscriptions: delete" on public.push_subscriptions
  for delete to authenticated using (auth.uid() = user_id);

grant select, delete on public.push_subscriptions to authenticated;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
end;
$$;
revoke all on function public.save_push_subscription(text, text, text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text) to authenticated;

-- 3. Food reminders (added later; running this whole file again adds them).
alter table public.notify_settings add column if not exists food_meals text[] not null default '{breakfast,lunch,dinner}';
alter table public.notify_settings add column if not exists food_eod boolean not null default true;
-- The daily calorie goal from Food Home, so the evening check knows what "under" means.
alter table public.notify_settings add column if not exists kcal_goal integer not null default 2000;
-- Which food reminders already went out today: { "date": "2026-10-16", "sent": ["lunch", "evening"] }.
alter table public.notify_settings add column if not exists food_sent jsonb;

-- Make the API notice the new tables right away.
notify pgrst, 'reload schema';

-- Check: should list notify_settings and push_subscriptions, both with rowsecurity = true.
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('notify_settings', 'push_subscriptions');
