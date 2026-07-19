-- Philamentix Hub V12
-- Einmal im Supabase SQL Editor ausführen.
-- Speichert die Dashboard-Widget-Anordnung pro Benutzer.

begin;

create table if not exists public.dashboard_preferences (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade
    default auth.uid(),
  widgets jsonb not null
    default '[]'::jsonb,
  updated_at timestamptz not null
    default now(),
  constraint dashboard_preferences_widgets_array
    check (jsonb_typeof(widgets) = 'array')
);

alter table public.dashboard_preferences
  enable row level security;

drop policy if exists
  "Users read own dashboard preferences"
  on public.dashboard_preferences;

drop policy if exists
  "Users insert own dashboard preferences"
  on public.dashboard_preferences;

drop policy if exists
  "Users update own dashboard preferences"
  on public.dashboard_preferences;

drop policy if exists
  "Users delete own dashboard preferences"
  on public.dashboard_preferences;

create policy
  "Users read own dashboard preferences"
on public.dashboard_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy
  "Users insert own dashboard preferences"
on public.dashboard_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy
  "Users update own dashboard preferences"
on public.dashboard_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy
  "Users delete own dashboard preferences"
on public.dashboard_preferences
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all
on table public.dashboard_preferences
from anon;

grant select, insert, update, delete
on table public.dashboard_preferences
to authenticated;

commit;
