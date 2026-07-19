-- Philamentix Hub V14.5
-- Diese Datei erneut vollständig im Supabase SQL Editor ausführen.
-- Speichert Darstellung und Standardwerte pro Benutzer.

begin;

create table if not exists public.user_preferences (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade
    default auth.uid(),
  filament_image_mode text not null
    default 'large',
  default_manufacturer text not null
    default '',
  default_material text not null
    default 'PLA',
  default_weight_per_roll integer not null
    default 1000,
  default_location text not null
    default '',
  default_minimum_stock integer not null
    default 1,
  updated_at timestamptz not null
    default now()
);

alter table public.user_preferences
  add column if not exists filament_image_mode text
  not null default 'large';

alter table public.user_preferences
  add column if not exists default_manufacturer text
  not null default '';

alter table public.user_preferences
  add column if not exists default_material text
  not null default 'PLA';

alter table public.user_preferences
  add column if not exists default_weight_per_roll integer
  not null default 1000;

alter table public.user_preferences
  add column if not exists default_location text
  not null default '';

alter table public.user_preferences
  add column if not exists default_minimum_stock integer
  not null default 1;

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

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'user_preferences_default_weight_check'
  ) then
    alter table public.user_preferences
      add constraint
        user_preferences_default_weight_check
      check (
        default_weight_per_roll
        between 1 and 50000
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'user_preferences_default_minimum_check'
  ) then
    alter table public.user_preferences
      add constraint
        user_preferences_default_minimum_check
      check (
        default_minimum_stock
        between 0 and 9999
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
