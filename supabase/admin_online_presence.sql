-- Philamentix Hub V15.1 – sicherer Online-Status
-- Einmal vollständig im Supabase SQL Editor ausführen.
-- Nutzer können ausschließlich ihren eigenen Heartbeat aktualisieren.
-- Der Zeitstempel wird serverseitig mit now() erzeugt.

begin;

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
using (
  (select auth.uid()) = user_id
);

create policy
  "Users insert own presence"
on public.user_presence
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);

create policy
  "Users update own presence"
on public.user_presence
for update
to authenticated
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
);

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
