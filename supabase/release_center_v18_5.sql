-- Philamentix Hub V18.5 BETA – Release Center & System-Log
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

alter table public.app_release_state
  add column if not exists production_channel text not null default 'PRODUCTION',
  add column if not exists production_version text not null default '',
  add column if not exists production_message text not null default '',
  add column if not exists production_message_enabled boolean not null default false,
  add column if not exists production_release_enabled boolean not null default false;

create table if not exists public.release_builds (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  channel text not null,
  changelog text not null default '',
  source_filename text not null,
  file_count integer not null default 0,
  commit_sha text null,
  git_branch text null,
  status text not null default 'uploaded',
  error_message text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint release_builds_channel_check check (channel in ('production','beta','public')),
  constraint release_builds_status_check check (status in ('uploaded','pushing','pushed','failed'))
);

create index if not exists release_builds_created_at_idx on public.release_builds (created_at desc);
create index if not exists release_builds_channel_idx on public.release_builds (channel, created_at desc);

alter table public.release_builds enable row level security;
revoke all on table public.release_builds from anon, authenticated;
grant all on table public.release_builds to service_role;

create table if not exists public.app_event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  category text not null,
  action text not null,
  entity_type text null,
  entity_id text null,
  message text not null default '',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_event_logs_created_at_idx on public.app_event_logs (created_at desc);
create index if not exists app_event_logs_user_idx on public.app_event_logs (user_id, created_at desc);
create index if not exists app_event_logs_category_idx on public.app_event_logs (category, created_at desc);

alter table public.app_event_logs enable row level security;
drop policy if exists "Users insert own app events" on public.app_event_logs;
create policy "Users insert own app events"
on public.app_event_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

revoke all on table public.app_event_logs from anon;
grant insert on table public.app_event_logs to authenticated;
grant all on table public.app_event_logs to service_role;

-- -----------------------------------------------------------------
-- Automatischer System-Log für zentrale App-Tabellen
-- -----------------------------------------------------------------

create or replace function public.log_app_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_row jsonb;
  new_row jsonb;
  actor_id uuid;
  entity_value text;
  event_message text;
begin
  old_row := case when TG_OP in ('UPDATE', 'DELETE') then to_jsonb(OLD) else null end;
  new_row := case when TG_OP in ('INSERT', 'UPDATE') then to_jsonb(NEW) else null end;

  actor_id := coalesce(
    nullif(coalesce(new_row ->> 'user_id', old_row ->> 'user_id', ''), '')::uuid,
    (select auth.uid())
  );

  entity_value := coalesce(
    new_row ->> 'id',
    old_row ->> 'id',
    new_row ->> 'user_id',
    old_row ->> 'user_id'
  );

  event_message := case TG_OP
    when 'INSERT' then TG_TABLE_NAME || ' erstellt'
    when 'UPDATE' then TG_TABLE_NAME || ' geändert'
    when 'DELETE' then TG_TABLE_NAME || ' gelöscht'
    else TG_TABLE_NAME || ' verändert'
  end;

  insert into public.app_event_logs (
    user_id,
    category,
    action,
    entity_type,
    entity_id,
    message,
    details
  ) values (
    actor_id,
    TG_TABLE_NAME,
    lower(TG_OP),
    TG_TABLE_NAME,
    entity_value,
    event_message,
    jsonb_build_object(
      'before', old_row,
      'after', new_row,
      'trigger', 'database'
    )
  );

  return case when TG_OP = 'DELETE' then OLD else NEW end;
exception
  when others then
    -- Logging darf die eigentliche Benutzeraktion niemals blockieren.
    return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

revoke all on function public.log_app_table_change() from public, anon, authenticated;
grant execute on function public.log_app_table_change() to service_role;

-- Trigger nur für Tabellen anlegen, die in der jeweiligen Installation existieren.
do $$
declare
  table_name text;
  tracked_tables text[] := array[
    'filaments',
    'filament_logs',
    'orders',
    'print_files',
    'production_jobs',
    'production_printers',
    'production_quality_checks',
    'production_material_reservations',
    'maintenance_rules',
    'beta_testers'
  ];
begin
  foreach table_name in array tracked_tables loop
    if to_regclass('public.' || table_name) is not null then
      execute format(
        'drop trigger if exists %I on public.%I',
        'app_event_log_' || table_name,
        table_name
      );
      execute format(
        'create trigger %I after insert or update or delete on public.%I for each row execute function public.log_app_table_change()',
        'app_event_log_' || table_name,
        table_name
      );
    end if;
  end loop;
end;
$$;

commit;
