-- Philamentix Hub V18.0 BETA – Produktionszentrum
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

create extension if not exists pgcrypto;

create table if not exists public.production_printers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  model text not null default '' check (char_length(model) <= 160),
  location text not null default '' check (char_length(location) <= 160),
  notes text not null default '' check (char_length(notes) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  order_id uuid references public.orders(id) on delete set null,
  print_project_id uuid references public.print_projects(id) on delete set null,
  print_file_id uuid references public.print_project_files(id) on delete set null,
  filament_id bigint,
  printer_id uuid references public.production_printers(id) on delete set null,
  status text not null default 'queue'
    check (status in ('queue','preparation','printing','completed','failed','cancelled')),
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  quantity integer not null default 1 check (quantity between 1 and 9999),
  material_grams numeric(12,2) not null default 0 check (material_grams >= 0),
  estimated_minutes integer not null default 0 check (estimated_minutes >= 0),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  notes text not null default '' check (char_length(notes) <= 4000),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists production_printers_user_active_idx
  on public.production_printers(user_id, active, name);
create index if not exists production_jobs_user_status_idx
  on public.production_jobs(user_id, status, priority, created_at desc);
create index if not exists production_jobs_user_printer_idx
  on public.production_jobs(user_id, printer_id, status);
create index if not exists production_jobs_user_order_idx
  on public.production_jobs(user_id, order_id)
  where order_id is not null;
create index if not exists production_jobs_user_file_idx
  on public.production_jobs(user_id, print_file_id)
  where print_file_id is not null;

alter table public.production_printers enable row level security;
alter table public.production_jobs enable row level security;

drop policy if exists "Users read own production printers" on public.production_printers;
drop policy if exists "Users insert own production printers" on public.production_printers;
drop policy if exists "Users update own production printers" on public.production_printers;
drop policy if exists "Users delete own production printers" on public.production_printers;

create policy "Users read own production printers"
  on public.production_printers for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users insert own production printers"
  on public.production_printers for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own production printers"
  on public.production_printers for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete own production printers"
  on public.production_printers for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own production jobs" on public.production_jobs;
drop policy if exists "Users insert own production jobs" on public.production_jobs;
drop policy if exists "Users update own production jobs" on public.production_jobs;
drop policy if exists "Users delete own production jobs" on public.production_jobs;

create policy "Users read own production jobs"
  on public.production_jobs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own production jobs"
  on public.production_jobs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (
      order_id is null or exists (
        select 1 from public.orders item
        where item.id = order_id and item.user_id = (select auth.uid())
      )
    )
    and (
      print_project_id is null or exists (
        select 1 from public.print_projects item
        where item.id = print_project_id and item.user_id = (select auth.uid())
      )
    )
    and (
      print_file_id is null or exists (
        select 1 from public.print_project_files item
        where item.id = print_file_id and item.user_id = (select auth.uid())
      )
    )
    and (
      filament_id is null or exists (
        select 1 from public.filaments item
        where item.id = filament_id and item.user_id = (select auth.uid())
      )
    )
    and (
      printer_id is null or exists (
        select 1 from public.production_printers item
        where item.id = printer_id and item.user_id = (select auth.uid())
      )
    )
  );

create policy "Users update own production jobs"
  on public.production_jobs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (
      order_id is null or exists (
        select 1 from public.orders item
        where item.id = order_id and item.user_id = (select auth.uid())
      )
    )
    and (
      print_project_id is null or exists (
        select 1 from public.print_projects item
        where item.id = print_project_id and item.user_id = (select auth.uid())
      )
    )
    and (
      print_file_id is null or exists (
        select 1 from public.print_project_files item
        where item.id = print_file_id and item.user_id = (select auth.uid())
      )
    )
    and (
      filament_id is null or exists (
        select 1 from public.filaments item
        where item.id = filament_id and item.user_id = (select auth.uid())
      )
    )
    and (
      printer_id is null or exists (
        select 1 from public.production_printers item
        where item.id = printer_id and item.user_id = (select auth.uid())
      )
    )
  );

create policy "Users delete own production jobs"
  on public.production_jobs for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.production_printers from anon;
revoke all on table public.production_jobs from anon;
grant select, insert, update, delete on table public.production_printers to authenticated;
grant select, insert, update, delete on table public.production_jobs to authenticated;
grant all on table public.production_printers to service_role;
grant all on table public.production_jobs to service_role;

create or replace function public.set_production_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists production_printers_set_updated_at on public.production_printers;
create trigger production_printers_set_updated_at
before update on public.production_printers
for each row execute function public.set_production_updated_at();

drop trigger if exists production_jobs_set_updated_at on public.production_jobs;
create trigger production_jobs_set_updated_at
before update on public.production_jobs
for each row execute function public.set_production_updated_at();


-- Produktionszentrum auch in das bestehende Wartungs-Control-Center aufnehmen.
do $$
begin
  if to_regclass('public.maintenance_rules') is not null then
    execute 'alter table public.maintenance_rules drop constraint if exists maintenance_rules_area_check';
    execute $sql$
      alter table public.maintenance_rules
      add constraint maintenance_rules_area_check
      check (area in (
        'all','dashboard','statistics','storage','filaments','reorder','logs',
        'orders','print_library','production','profile','settings'
      ))
    $sql$;
  end if;
end
$$;

-- Realtime aktivieren, falls die Tabellen noch nicht in der Publication liegen.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'production_jobs'
    ) then
      execute 'alter publication supabase_realtime add table public.production_jobs';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'production_printers'
    ) then
      execute 'alter publication supabase_realtime add table public.production_printers';
    end if;
  end if;
end
$$;

commit;
