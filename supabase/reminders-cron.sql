-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Calls /api/notify every hour from Supabase itself. GitHub's scheduled runs are often hours
-- late (or skipped), which makes reminders miss their hour; Supabase's scheduler is on time.
-- Replace YOUR_CRON_SECRET with the CRON_SECRET value from Vercel before running.
-- Safe to run more than once: it replaces the job.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sendit-reminders') where exists (select 1 from cron.job where jobname = 'sendit-reminders');

select cron.schedule(
  'sendit-reminders',
  '2 * * * *',
  $$ select net.http_get(
       url := 'https://justsend.fit/api/notify',
       headers := jsonb_build_object('Authorization', 'Bearer YOUR_CRON_SECRET'),
       timeout_milliseconds := 60000
     ) $$
);

-- Check: should list the job. After the next hour, the second query shows its replies
-- (status_code 200 means it worked).
select jobname, schedule, active from cron.job where jobname = 'sendit-reminders';
-- select status_code, content, created from net._http_response order by created desc limit 5;
