-- Philamentix Hub V17.2.2 – Release-Kanäle, Roll-Message und Beta-Tester
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

create table if not exists public.app_release_state (
  id smallint primary key default 1,
  public_channel text not null default 'PROD',
  public_version text not null default '1.0',
  public_message text not null default '',
  public_message_enabled boolean not null default false,
  beta_channel text not null default 'BETA',
  beta_version text not null default '',
  beta_message text not null default '',
  beta_message_enabled boolean not null default false,
  beta_release_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null references auth.users(id) on delete set null,
  constraint app_release_state_singleton_check check (id = 1),
  constraint app_release_state_public_channel_length check (char_length(public_channel) between 1 and 24),
  constraint app_release_state_public_version_length check (char_length(public_version) between 1 and 40),
  constraint app_release_state_public_message_length check (char_length(public_message) <= 500),
  constraint app_release_state_beta_channel_length check (char_length(beta_channel) between 1 and 24),
  constraint app_release_state_beta_version_length check (char_length(beta_version) <= 40),
  constraint app_release_state_beta_message_length check (char_length(beta_message) <= 500)
);

insert into public.app_release_state (id)
values (1)
on conflict (id) do nothing;

alter table public.app_release_state enable row level security;

drop policy if exists "Authenticated users read release state" on public.app_release_state;

create policy "Authenticated users read release state"
on public.app_release_state
for select
to authenticated
using (true);

revoke all on table public.app_release_state from anon;
revoke insert, update, delete on table public.app_release_state from authenticated;
grant select on table public.app_release_state to authenticated;
grant all on table public.app_release_state to service_role;

create table if not exists public.beta_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null
);

create index if not exists beta_testers_enabled_idx
on public.beta_testers (enabled, updated_at desc);

alter table public.beta_testers enable row level security;

drop policy if exists "Users read own beta status" on public.beta_testers;

create policy "Users read own beta status"
on public.beta_testers
for select
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.beta_testers from anon;
revoke insert, update, delete on table public.beta_testers from authenticated;
grant select on table public.beta_testers to authenticated;
grant all on table public.beta_testers to service_role;

commit;
