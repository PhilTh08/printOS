-- Philamentix Hub V15 – Admin- und Supportsystem
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

create table if not exists public.user_roles (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  role text not null,
  created_at timestamptz not null
    default now(),
  created_by uuid null
    references auth.users(id)
    on delete set null,
  constraint user_roles_role_check
    check (role in ('admin'))
);

alter table public.user_roles
  enable row level security;

drop policy if exists
  "Users read own role"
  on public.user_roles;

create policy
  "Users read own role"
on public.user_roles
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all
on table public.user_roles
from anon;

revoke insert, update, delete
on table public.user_roles
from authenticated;

grant select
on table public.user_roles
to authenticated;

grant all
on table public.user_roles
to service_role;

create table if not exists public.admin_action_logs (
  id uuid primary key
    default gen_random_uuid(),
  admin_user_id uuid null
    references auth.users(id)
    on delete set null,
  target_user_id uuid null
    references auth.users(id)
    on delete set null,
  action text not null,
  entity_type text null,
  entity_id text null,
  reason text not null,
  status text not null
    default 'pending',
  before_data jsonb null,
  after_data jsonb null,
  details jsonb not null
    default '{}'::jsonb,
  error_message text null,
  created_at timestamptz not null
    default now(),
  completed_at timestamptz null,
  constraint admin_action_logs_status_check
    check (
      status in (
        'pending',
        'success',
        'failed'
      )
    )
);

create index if not exists
  admin_action_logs_created_at_idx
on public.admin_action_logs
  (created_at desc);

create index if not exists
  admin_action_logs_target_user_idx
on public.admin_action_logs
  (target_user_id, created_at desc);

create index if not exists
  admin_action_logs_admin_user_idx
on public.admin_action_logs
  (admin_user_id, created_at desc);

alter table public.admin_action_logs
  enable row level security;

revoke all
on table public.admin_action_logs
from anon, authenticated;

grant all
on table public.admin_action_logs
to service_role;

-- ---------------------------------------------------------------
-- Online-Status
-- ---------------------------------------------------------------

create table if not exists public.user_presence (
  user_id uuid primary key
    references auth.users(id)
    on delete cascade,
  last_seen_at timestamptz not null
    default now()
);

create index if not exists
  user_presence_last_seen_idx
on public.user_presence
  (last_seen_at desc);

alter table public.user_presence
  enable row level security;

drop policy if exists
  "Users read own presence"
  on public.user_presence;

drop policy if exists
  "Users insert own presence"
  on public.user_presence;

drop policy if exists
  "Users update own presence"
  on public.user_presence;

create policy
  "Users read own presence"
on public.user_presence
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy
  "Users insert own presence"
on public.user_presence
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy
  "Users update own presence"
on public.user_presence
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all
on table public.user_presence
from anon;

grant select, insert, update
on table public.user_presence
to authenticated;

grant all
on table public.user_presence
to service_role;

create or replace function
  public.touch_user_presence()
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  touched_at timestamptz;
begin
  if (select auth.uid()) is null then
    raise exception
      'Authentication required';
  end if;

  insert into public.user_presence (
    user_id,
    last_seen_at
  )
  values (
    (select auth.uid()),
    now()
  )
  on conflict (user_id)
  do update
  set last_seen_at = now()
  returning last_seen_at
  into touched_at;

  return touched_at;
end;
$$;

revoke all
on function public.touch_user_presence()
from public, anon;

grant execute
on function public.touch_user_presence()
to authenticated;

commit;

-- ================================================================
-- ADMIN EINTRAGEN
-- ================================================================
-- Nach der Migration die E-Mail ersetzen und diesen Block separat
-- ausführen. Die Rolle wird ausschließlich in Supabase vergeben.
--
-- insert into public.user_roles (
--   user_id,
--   role
-- )
-- select
--   id,
--   'admin'
-- from auth.users
-- where lower(email) = lower('DEINE-EMAIL@BEISPIEL.DE')
-- on conflict (user_id)
-- do update set role = excluded.role;
--
-- ADMIN ENTFERNEN:
--
-- delete from public.user_roles
-- where user_id = (
--   select id
--   from auth.users
--   where lower(email) = lower('DEINE-EMAIL@BEISPIEL.DE')
-- );
