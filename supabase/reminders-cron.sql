-- Runs the send-reminders Edge Function every 5 minutes.
-- Run once in the SQL Editor AFTER deploying the function (see README → Push reminders).
-- Replace <project-ref> with your project's ref and <cron-secret> with the CRON_SECRET you set on the function.
-- Safe to re-run: it replaces the schedule and the stored secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- keep the secret in Vault, not in the job text
delete from vault.secrets where name = 'reminders_cron_secret';
select vault.create_secret('<cron-secret>', 'reminders_cron_secret');

select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'reminders_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
