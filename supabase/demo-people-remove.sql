-- Removes the demo people added by supabase/demo-people.sql, and everything they logged.
-- Real accounts are never touched: it only deletes accounts that have BOTH demo_seed = true in
-- their app metadata AND an email ending in @demo.justsend.fit, which nobody can sign up with.
-- Run in the Supabase dashboard: SQL Editor > New query > paste > Run. Safe to run more than once.

do $$
declare
  t text;
  demo text := $q$select id from auth.users
    where raw_app_meta_data->>'demo_seed' = 'true' and email like '%@demo.justsend.fit'$q$;
begin
  foreach t in array array['climbs', 'workouts', 'food_logs', 'food_photo_requests', 'coach_requests'] loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where user_id in (%s)', t, demo);
    end if;
  end loop;
  execute format('delete from auth.users where id in (%s)', demo);
end $$;

-- Check: should say 0.
select count(*) as demo_people_left from auth.users where raw_app_meta_data->>'demo_seed' = 'true';
