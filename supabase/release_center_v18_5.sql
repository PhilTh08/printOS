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
create policy "Users insert own app events" on public.app_event_logs for insert to authenticated with check ((select auth.uid()) = user_id);

revoke all on table public.app_event_logs from anon;
grant insert on table public.app_event_logs to authenticated;
grant all on table public.app_event_logs to service_role;

commit;
