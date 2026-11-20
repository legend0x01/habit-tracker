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
