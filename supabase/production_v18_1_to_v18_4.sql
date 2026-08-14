-- Philamentix Hub V18.1–V18.4 BETA
-- Kumulative Migration: Drucker-Flotte, Wartung, Smart Queue,
-- Materialreservierung, Qualitätskontrolle, Nachdrucke und QR-Etiketten.
-- Voraussetzung: production_v18_0.sql wurde bereits ausgeführt.

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- V18.1 – Drucker-Flotte & Wartung
-- ============================================================

alter table public.production_printers
  add column if not exists serial_number text not null default '',
  add column if not exists nozzle_mm numeric(4,2) not null default 0.40,
  add column if not exists print_minutes_total integer not null default 0,
  add column if not exists print_minutes_at_last_maintenance integer not null default 0,
  add column if not exists maintenance_interval_hours numeric(10,2) not null default 100,
  add column if not exists last_maintenance_at timestamptz;

alter table public.production_printers
  drop constraint if exists production_printers_nozzle_mm_check;
alter table public.production_printers
  add constraint production_printers_nozzle_mm_check check (nozzle_mm > 0 and nozzle_mm <= 5);

alter table public.production_printers
  drop constraint if exists production_printers_print_minutes_total_check;
alter table public.production_printers
  add constraint production_printers_print_minutes_total_check check (print_minutes_total >= 0);

alter table public.production_printers
  drop constraint if exists production_printers_print_minutes_at_last_maintenance_check;
alter table public.production_printers
  add constraint production_printers_print_minutes_at_last_maintenance_check check (print_minutes_at_last_maintenance >= 0);

alter table public.production_printers
  drop constraint if exists production_printers_maintenance_interval_hours_check;
alter table public.production_printers
  add constraint production_printers_maintenance_interval_hours_check check (maintenance_interval_hours > 0);

create table if not exists public.production_maintenance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  printer_id uuid not null references public.production_printers(id) on delete cascade,
  kind text not null default 'service' check (kind in ('service','cleaning','nozzle','lubrication','repair','other')),
  notes text not null default '' check (char_length(notes) <= 4000),
  performed_at timestamptz not null default now(),
  print_minutes_at_service integer not null default 0 check (print_minutes_at_service >= 0),
  created_at timestamptz not null default now()
);

create index if not exists production_maintenance_logs_user_printer_idx
  on public.production_maintenance_logs(user_id, printer_id, performed_at desc);

alter table public.production_maintenance_logs enable row level security;

drop policy if exists "Users read own production maintenance" on public.production_maintenance_logs;
drop policy if exists "Users insert own production maintenance" on public.production_maintenance_logs;
drop policy if exists "Users update own production maintenance" on public.production_maintenance_logs;
drop policy if exists "Users delete own production maintenance" on public.production_maintenance_logs;

create policy "Users read own production maintenance"
  on public.production_maintenance_logs for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own production maintenance"
  on public.production_maintenance_logs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.production_printers printer
      where printer.id = printer_id and printer.user_id = (select auth.uid())
    )
  );

create policy "Users update own production maintenance"
  on public.production_maintenance_logs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.production_printers printer
      where printer.id = printer_id and printer.user_id = (select auth.uid())
    )
  );

create policy "Users delete own production maintenance"
  on public.production_maintenance_logs for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.production_maintenance_logs from anon;
grant select, insert, update, delete on table public.production_maintenance_logs to authenticated;
grant all on table public.production_maintenance_logs to service_role;

-- ============================================================
-- V18.2 – Materialreservierung & Smart Queue
-- Reservierung wird aus aktiven production_jobs berechnet.
-- ============================================================

alter table public.production_jobs
  add column if not exists queue_position integer not null default 0,
  add column if not exists planned_start_at timestamptz,
  add column if not exists planned_finish_at timestamptz,
  add column if not exists runtime_accounted_at timestamptz;

alter table public.production_jobs
  drop constraint if exists production_jobs_queue_position_check;
alter table public.production_jobs
  add constraint production_jobs_queue_position_check check (queue_position >= 0);

create index if not exists production_jobs_user_plan_idx
  on public.production_jobs(user_id, printer_id, queue_position, planned_start_at)
  where status in ('queue','preparation','printing');

-- ============================================================
-- V18.3 – Qualitätskontrolle & Nachdrucke
-- ============================================================

alter table public.production_jobs
  add column if not exists parent_job_id uuid references public.production_jobs(id) on delete set null;

alter table public.production_jobs drop constraint if exists production_jobs_status_check;
alter table public.production_jobs
  add constraint production_jobs_status_check
  check (status in ('queue','preparation','printing','quality_check','completed','failed','cancelled'));

create index if not exists production_jobs_user_parent_idx
  on public.production_jobs(user_id, parent_job_id)
  where parent_job_id is not null;

-- Bestehende Job-Policies um die neue parent_job_id absichern.
drop policy if exists "Users insert own production jobs" on public.production_jobs;
drop policy if exists "Users update own production jobs" on public.production_jobs;

create policy "Users insert own production jobs"
  on public.production_jobs for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (order_id is null or exists (select 1 from public.orders item where item.id = order_id and item.user_id = (select auth.uid())))
    and (print_project_id is null or exists (select 1 from public.print_projects item where item.id = print_project_id and item.user_id = (select auth.uid())))
    and (print_file_id is null or exists (select 1 from public.print_project_files item where item.id = print_file_id and item.user_id = (select auth.uid())))
    and (filament_id is null or exists (select 1 from public.filaments item where item.id = filament_id and item.user_id = (select auth.uid())))
    and (printer_id is null or exists (select 1 from public.production_printers item where item.id = printer_id and item.user_id = (select auth.uid())))
    and (parent_job_id is null or exists (select 1 from public.production_jobs item where item.id = parent_job_id and item.user_id = (select auth.uid())))
  );

create policy "Users update own production jobs"
  on public.production_jobs for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (order_id is null or exists (select 1 from public.orders item where item.id = order_id and item.user_id = (select auth.uid())))
    and (print_project_id is null or exists (select 1 from public.print_projects item where item.id = print_project_id and item.user_id = (select auth.uid())))
    and (print_file_id is null or exists (select 1 from public.print_project_files item where item.id = print_file_id and item.user_id = (select auth.uid())))
    and (filament_id is null or exists (select 1 from public.filaments item where item.id = filament_id and item.user_id = (select auth.uid())))
    and (printer_id is null or exists (select 1 from public.production_printers item where item.id = printer_id and item.user_id = (select auth.uid())))
    and (parent_job_id is null or exists (select 1 from public.production_jobs item where item.id = parent_job_id and item.user_id = (select auth.uid())))
  );

create table if not exists public.production_quality_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.production_jobs(id) on delete cascade,
  result text not null check (result in ('passed','failed')),
  visual_ok boolean not null default true,
  dimensions_ok boolean not null default true,
  adhesion_ok boolean not null default true,
  color_ok boolean not null default true,
  damage_free boolean not null default true,
  failure_reason text not null default '' check (char_length(failure_reason) <= 500),
  notes text not null default '' check (char_length(notes) <= 4000),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists production_quality_checks_user_job_idx
  on public.production_quality_checks(user_id, job_id, checked_at desc);

alter table public.production_quality_checks enable row level security;

drop policy if exists "Users read own production quality" on public.production_quality_checks;
drop policy if exists "Users insert own production quality" on public.production_quality_checks;
drop policy if exists "Users update own production quality" on public.production_quality_checks;
drop policy if exists "Users delete own production quality" on public.production_quality_checks;

create policy "Users read own production quality"
  on public.production_quality_checks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own production quality"
  on public.production_quality_checks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.production_jobs job
      where job.id = job_id and job.user_id = (select auth.uid())
    )
  );

create policy "Users update own production quality"
  on public.production_quality_checks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.production_jobs job
      where job.id = job_id and job.user_id = (select auth.uid())
    )
  );

create policy "Users delete own production quality"
  on public.production_quality_checks for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.production_quality_checks from anon;
grant select, insert, update, delete on table public.production_quality_checks to authenticated;
grant all on table public.production_quality_checks to service_role;

-- Druckzeit genau einmal auf den Drucker buchen, sobald der Druck physisch fertig ist.
create or replace function public.account_production_runtime()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status in ('quality_check','completed')
     and old.status not in ('quality_check','completed')
     and new.runtime_accounted_at is null then
    if new.printer_id is not null then
      update public.production_printers
      set print_minutes_total = print_minutes_total + greatest(coalesce(new.estimated_minutes, 0), 0)
      where id = new.printer_id and user_id = new.user_id;
    end if;
    new.runtime_accounted_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists production_jobs_account_runtime on public.production_jobs;
create trigger production_jobs_account_runtime
before update of status on public.production_jobs
for each row execute function public.account_production_runtime();

-- ============================================================
-- V18.4 – Produktionsetiketten & QR-Codes
-- ============================================================

alter table public.production_jobs
  add column if not exists label_code text not null default '',
  add column if not exists label_print_count integer not null default 0,
  add column if not exists label_last_printed_at timestamptz;

alter table public.production_jobs
  drop constraint if exists production_jobs_label_print_count_check;
alter table public.production_jobs
  add constraint production_jobs_label_print_count_check check (label_print_count >= 0);

create or replace function public.ensure_production_label_code()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(trim(new.label_code), '') = '' then
    new.label_code = 'PH-' || upper(substr(replace(new.id::text, '-', ''), 1, 12));
  end if;
  return new;
end;
$$;

update public.production_jobs
set label_code = 'PH-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where coalesce(trim(label_code), '') = '';

create unique index if not exists production_jobs_user_label_code_uidx
  on public.production_jobs(user_id, label_code)
  where label_code <> '';

create index if not exists production_jobs_user_label_lookup_idx
  on public.production_jobs(user_id, label_code);

drop trigger if exists production_jobs_ensure_label_code on public.production_jobs;
create trigger production_jobs_ensure_label_code
before insert or update of label_code on public.production_jobs
for each row execute function public.ensure_production_label_code();

-- ============================================================
-- Realtime für neue Tabellen
-- ============================================================

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'production_maintenance_logs'
    ) then
      execute 'alter publication supabase_realtime add table public.production_maintenance_logs';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'production_quality_checks'
    ) then
      execute 'alter publication supabase_realtime add table public.production_quality_checks';
    end if;
  end if;
end
$$;

commit;
