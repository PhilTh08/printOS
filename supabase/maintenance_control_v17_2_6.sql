-- Philamentix Hub V17.2.6 – Wartungs-Control-Center
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

create table if not exists public.maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  user_id uuid null references auth.users(id) on delete cascade,
  area text not null,
  mode text not null default 'maintenance',
  message text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  constraint maintenance_rules_scope_check
    check (scope in ('global', 'user')),
  constraint maintenance_rules_area_check
    check (area in (
      'all',
      'dashboard',
      'statistics',
      'storage',
      'filaments',
      'reorder',
      'logs',
      'orders',
      'print_library',
      'profile',
      'settings'
    )),
  constraint maintenance_rules_mode_check
    check (mode in ('maintenance', 'available')),
  constraint maintenance_rules_message_length_check
    check (char_length(message) <= 500),
  constraint maintenance_rules_scope_user_check
    check (
      (scope = 'global' and user_id is null)
      or
      (scope = 'user' and user_id is not null)
    )
);

create unique index if not exists maintenance_rules_global_area_unique
on public.maintenance_rules (area)
where scope = 'global';

create unique index if not exists maintenance_rules_user_area_unique
on public.maintenance_rules (user_id, area)
where scope = 'user';

create index if not exists maintenance_rules_user_lookup_idx
on public.maintenance_rules (user_id, enabled, area);

alter table public.maintenance_rules enable row level security;

drop policy if exists "Users read applicable maintenance rules" on public.maintenance_rules;

create policy "Users read applicable maintenance rules"
on public.maintenance_rules
for select
to authenticated
using (
  scope = 'global'
  or (scope = 'user' and user_id = (select auth.uid()))
);

revoke all on table public.maintenance_rules from anon;
revoke insert, update, delete on table public.maintenance_rules from authenticated;
grant select on table public.maintenance_rules to authenticated;
grant all on table public.maintenance_rules to service_role;

-- Realtime sorgt dafür, dass Wartungsänderungen bei angemeldeten Nutzern
-- ohne manuellen Reload ankommen. Falls die Tabelle bereits in der
-- Publication steckt, wird der Fehler bewusst ignoriert.
do $$
begin
  alter publication supabase_realtime add table public.maintenance_rules;
exception
  when duplicate_object then null;
end $$;

commit;
