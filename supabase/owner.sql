-- Owner stats: lets the app owner see app-wide numbers (users, active users, entries)
-- on the Stats screen in the You tab. Nobody else can call it.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run more than once. Put your own sign-in email in step 1.

-- 1. Who counts as an owner. No policies, so the app can't read or change this table;
--    only the functions below (and you, in the dashboard) can.
create table if not exists public.app_owners (
  email text primary key
);
alter table public.app_owners enable row level security;
insert into public.app_owners (email) values ('you@example.com') on conflict do nothing;

-- 2. Is the signed-in person an owner? The app uses this to show the Stats row.
create or replace function public.is_owner()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join public.app_owners o on lower(o.email) = lower(u.email)
    where u.id = auth.uid()
  );
$$;

-- 3. App-wide numbers. Refuses anyone who isn't an owner.
--    tz is the phone's time zone, so "today" and the daily chart match the owner's day.
--    Tables that don't exist yet are skipped instead of breaking the whole screen.
create or replace function public.owner_stats(tz text default 'UTC')
returns jsonb
language plpgsql stable security definer
set search_path = public
as $$
declare
  parts text[] := '{}';
  t record;
  result jsonb;
  photos bigint := 0;
  coach bigint := 0;
begin
  if not public.is_owner() then
    raise exception 'Only the app owner can see these stats.' using errcode = '42501';
  end if;
  if tz is null or not exists (select 1 from pg_timezone_names where name = tz) then
    tz := 'UTC';
  end if;

  for t in select * from (values ('climbs', 'climbing'), ('workouts', 'lifting'), ('food_logs', 'food')) v(tbl, sport) loop
    if to_regclass('public.' || t.tbl) is not null then
      parts := parts || format('select user_id, created_at, %L::text as sport from public.%I', t.sport, t.tbl);
    end if;
  end loop;
  if cardinality(parts) = 0 then
    parts := array['select null::uuid as user_id, null::timestamptz as created_at, null::text as sport where false'];
  end if;

  if to_regclass('public.food_photo_requests') is not null then
    execute 'select count(*) from public.food_photo_requests' into photos;
  end if;
  if to_regclass('public.coach_requests') is not null then
    execute 'select count(*) from public.coach_requests' into coach;
  end if;

  execute format($q$
    with activity as (%s),
    people as (select id, created_at, last_sign_in_at from auth.users),
    days as (
      select generate_series((now() at time zone $1)::date - 29, (now() at time zone $1)::date, interval '1 day')::date as day
    )
    select jsonb_build_object(
      'users', (select jsonb_build_object(
        'total', count(*),
        'new_7d', count(*) filter (where created_at > now() - interval '7 days'),
        'new_30d', count(*) filter (where created_at > now() - interval '30 days'),
        'signed_in_7d', count(*) filter (where last_sign_in_at > now() - interval '7 days')
      ) from people),
      'active', (select jsonb_build_object(
        'd1', count(distinct user_id) filter (where created_at > now() - interval '1 day'),
        'd7', count(distinct user_id) filter (where created_at > now() - interval '7 days'),
        'd30', count(distinct user_id) filter (where created_at > now() - interval '30 days'),
        'ever', count(distinct user_id)
      ) from activity),
      'entries', (select jsonb_build_object(
        'total', count(*),
        'd7', count(*) filter (where created_at > now() - interval '7 days')
      ) from activity),
      'sports', (select coalesce(jsonb_agg(jsonb_build_object('sport', sport, 'users', u, 'entries', n, 'entries_7d', n7) order by n desc), '[]'::jsonb)
        from (select sport, count(distinct user_id) u, count(*) n, count(*) filter (where created_at > now() - interval '7 days') n7
              from activity group by sport) s),
      'daily', (select jsonb_agg(jsonb_build_object(
        'day', d.day,
        'signups', (select count(*) from people p where (p.created_at at time zone $1)::date = d.day),
        'active', (select count(distinct a.user_id) from activity a where (a.created_at at time zone $1)::date = d.day),
        'entries', (select count(*) from activity a where (a.created_at at time zone $1)::date = d.day)
      ) order by d.day) from days d)
    )
  $q$, array_to_string(parts, ' union all ')) into result using tz;

  return result || jsonb_build_object('photo_scans', photos, 'coach_questions', coach, 'generated_at', now());
end;
$$;

revoke all on function public.is_owner() from public, anon;
revoke all on function public.owner_stats(text) from public, anon;
grant execute on function public.is_owner() to authenticated;
grant execute on function public.owner_stats(text) to authenticated;

notify pgrst, 'reload schema';

-- Check: should return true when run as you from the app. In the SQL Editor it says false,
-- because the editor isn't signed in as a user. This lists the owners instead:
select * from public.app_owners;
