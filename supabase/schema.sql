-- Habit Tracker database schema.
-- Run once in your Supabase project: SQL Editor → New query → paste → Run.
-- Safe to re-run.

-- One row per user per year. `data` holds the whole year (habits, goals, checks, notes).
create table if not exists public.habit_years (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  year       integer     not null check (year between 1900 and 2200),
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, year),
  constraint habit_years_data_size check (pg_column_size(data) < 1000000)
);

-- Row-level security: every user can only see and change their own rows.
alter table public.habit_years enable row level security;

drop policy if exists "habit_years: select own" on public.habit_years;
drop policy if exists "habit_years: insert own" on public.habit_years;
drop policy if exists "habit_years: update own" on public.habit_years;
drop policy if exists "habit_years: delete own" on public.habit_years;

create policy "habit_years: select own" on public.habit_years
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "habit_years: insert own" on public.habit_years
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "habit_years: update own" on public.habit_years
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "habit_years: delete own" on public.habit_years
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Realtime: lets an open tab pick up changes made on your other devices.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'habit_years'
  ) then
    alter publication supabase_realtime add table public.habit_years;
  end if;
end $$;

-- Self-service account deletion: the "Delete my account" button calls this.
-- It deletes the signed-in user; their habit_years rows go with it (on delete cascade).
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Push reminders: one row per device that turned on the daily reminder while signed in.
-- The send-reminders Edge Function reads these (with the service role) and sends Web Push
-- notifications even when the app is closed. Users can only see and change their own devices.
create table if not exists public.push_subscriptions (
  endpoint   text        primary key
             check (length(endpoint) < 1000
               and endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com)/'),
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh     text        not null check (length(p256dh) < 200),
  auth       text        not null check (length(auth) < 100),
  remind_at  text        not null check (remind_at ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  tz         text        not null check (length(tz) between 1 and 64),
  last_sent  date,
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions: select own" on public.push_subscriptions;
drop policy if exists "push_subscriptions: insert own" on public.push_subscriptions;
drop policy if exists "push_subscriptions: update own" on public.push_subscriptions;
drop policy if exists "push_subscriptions: delete own" on public.push_subscriptions;

create policy "push_subscriptions: select own" on public.push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "push_subscriptions: insert own" on public.push_subscriptions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "push_subscriptions: update own" on public.push_subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "push_subscriptions: delete own" on public.push_subscriptions
  for delete to authenticated using ((select auth.uid()) = user_id);
