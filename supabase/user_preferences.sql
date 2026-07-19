-- Philamentix Hub V14.4
-- Einmal im Supabase SQL Editor ausführen.
-- Speichert persönliche Darstellungsoptionen geräteübergreifend.

begin;

create table if not exists public.user_preferences (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade
    default auth.uid(),
  filament_image_mode text not null
    default 'large',
  updated_at timestamptz not null
    default now()
);

alter table public.user_preferences
  add column if not exists filament_image_mode text
  not null default 'large';

alter table public.user_preferences
  add column if not exists updated_at timestamptz
  not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'user_preferences_filament_image_mode_check'
  ) then
    alter table public.user_preferences
      add constraint
        user_preferences_filament_image_mode_check
      check (
        filament_image_mode in (
          'off',
          'small',
          'large'
        )
      );
  end if;
end
$$;

alter table public.user_preferences
  enable row level security;

drop policy if exists
  "Users read own preferences"
  on public.user_preferences;

drop policy if exists
  "Users insert own preferences"
  on public.user_preferences;

drop policy if exists
  "Users update own preferences"
  on public.user_preferences;

drop policy if exists
  "Users delete own preferences"
  on public.user_preferences;

create policy
  "Users read own preferences"
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy
  "Users insert own preferences"
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy
  "Users update own preferences"
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy
  "Users delete own preferences"
on public.user_preferences
for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all
on table public.user_preferences
from anon;

grant select, insert, update, delete
on table public.user_preferences
to authenticated;

commit;
