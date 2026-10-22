-- Brings the demo people (supabase/demo-people.sql) up to today: for every day since each
-- person's last entry, they log on about as often as they did before, repeating one of their
-- own earlier days (same workout, climbs or meals, moved to the new day at the same local time).
-- People who had stopped using the app stay stopped. Real accounts are never touched.
-- Run in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to run again later: it only fills the days after each person's latest entry.
-- Everything it adds belongs to the demo people, so supabase/demo-people-remove.sql removes it too.

do $$
declare
  u record;
  filled date;
  tz text;
  tbl text;
  col text;
  cols text;
  last_t timestamptz;
  seed_end timestamptz;
  rate float;
  src date;
  d date;
begin
  -- The latest demo entry overall; anyone quiet for a week before it had stopped using the app.
  select max(c) into seed_end from (
    select w.performed_at c from public.workouts w join auth.users x on x.id = w.user_id where x.raw_app_meta_data->>'demo_seed' = 'true'
    union all select c.created_at from public.climbs c join auth.users x on x.id = c.user_id where x.raw_app_meta_data->>'demo_seed' = 'true'
    union all select f.eaten_at from public.food_logs f join auth.users x on x.id = f.user_id where x.raw_app_meta_data->>'demo_seed' = 'true') y;
  if seed_end is null then
    raise notice 'No demo people found. Run supabase/demo-people.sql first.';
    return;
  end if;

  for u in select id, email, raw_app_meta_data->>'demo_filled_to' as filled_to from auth.users
           where raw_app_meta_data->>'demo_seed' = 'true' and email like '%@demo.justsend.fit' loop
    tz := case split_part(u.email, '@', 1) when 'priya.nair' then 'Asia/Kolkata' when 'aroha.ngata' then 'Pacific/Auckland' else 'America/New_York' end;

    foreach tbl in array array['workouts', 'climbs', 'food_logs'] loop
      col := case tbl when 'workouts' then 'performed_at' when 'climbs' then 'created_at' else 'eaten_at' end;
      cols := case tbl
        when 'workouts' then 'title, duration_min, exercises'
        when 'climbs' then 'grade, style, wall_angle, hold_type, attempts, sent, notes'
        else 'meal, name, source, amount, unit, grams, kcal, protein_g, carbs_g, fat_g, food' end;

      execute format('select max(%I) from public.%I where user_id = $1', col, tbl) into last_t using u.id;
      continue when last_t is null or last_t < seed_end - interval '7 days';

      -- Share of days they logged anything, from their first entry to their last.
      execute format($q$select count(distinct (%1$I at time zone $2)::date)::float
                        / greatest(1, (max(%1$I) at time zone $2)::date - (min(%1$I) at time zone $2)::date + 1)
                     from public.%2$I where user_id = $1$q$, col, tbl) into rate using u.id, tz;

      -- Days already rolled by an earlier run of this script are not rolled again.
      filled := greatest((last_t at time zone tz)::date, u.filled_to::date);
      for d in select generate_series(filled + 1, (now() at time zone tz)::date, interval '1 day')::date loop
        continue when random() > rate;
        -- Repeat one of their own earlier days.
        execute format($q$select (%1$I at time zone $2)::date from public.%2$I
                          where user_id = $1 and %1$I <= $3 order by random() limit 1$q$, col, tbl)
          into src using u.id, tz, seed_end;
        if tbl = 'workouts' then
          execute format($q$insert into public.workouts (user_id, performed_at, created_at, %1$s)
            select user_id, performed_at + ($2 - $3) * interval '1 day', created_at + ($2 - $3) * interval '1 day', %1$s
            from public.workouts where user_id = $1 and (performed_at at time zone $4)::date = $3
              and performed_at + ($2 - $3) * interval '1 day' <= now()$q$, cols)
            using u.id, d, src, tz;
        elsif tbl = 'climbs' then
          execute format($q$insert into public.climbs (user_id, created_at, %1$s)
            select user_id, created_at + ($2 - $3) * interval '1 day', %1$s
            from public.climbs where user_id = $1 and (created_at at time zone $4)::date = $3
              and created_at + ($2 - $3) * interval '1 day' <= now()$q$, cols)
            using u.id, d, src, tz;
        else
          execute format($q$insert into public.food_logs (user_id, eaten_at, created_at, %1$s)
            select user_id, eaten_at + ($2 - $3) * interval '1 day', created_at + ($2 - $3) * interval '1 day', %1$s
            from public.food_logs where user_id = $1 and (eaten_at at time zone $4)::date = $3
              and eaten_at + ($2 - $3) * interval '1 day' <= now()$q$, cols)
            using u.id, d, src, tz;
        end if;
      end loop;
    end loop;

    -- Last seen at their latest entry; remember which days this script has filled.
    update auth.users set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('demo_filled_to', (now() at time zone tz)::date - 1) where id = u.id;
    update auth.users set last_sign_in_at = greatest(last_sign_in_at, x.t), updated_at = greatest(updated_at, x.t)
    from (select max(c) t from (
      select created_at c from public.workouts where user_id = u.id
      union all select created_at from public.climbs where user_id = u.id
      union all select created_at from public.food_logs where user_id = u.id) y) x
    where id = u.id and x.t is not null;
  end loop;
end $$;

-- Check: the demo people's entries since Oct 5, and their latest entry.
select
  (select count(*) from public.workouts w join auth.users u on u.id = w.user_id where u.raw_app_meta_data->>'demo_seed' = 'true' and w.performed_at >= '2026-10-05') as new_workouts,
  (select count(*) from public.climbs c join auth.users u on u.id = c.user_id where u.raw_app_meta_data->>'demo_seed' = 'true' and c.created_at >= '2026-10-05') as new_climbs,
  (select count(*) from public.food_logs f join auth.users u on u.id = f.user_id where u.raw_app_meta_data->>'demo_seed' = 'true' and f.eaten_at >= '2026-10-05') as new_food_logs,
  (select max(last_sign_in_at) from auth.users where raw_app_meta_data->>'demo_seed' = 'true') as latest_activity;
