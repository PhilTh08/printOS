-- Philamentix Hub V17.2.9 – Druckbibliothek Rescan
-- Nach V17.2 einmal vollständig im Supabase SQL Editor ausführen.

begin;

alter table public.print_projects
  add column if not exists scan_root_name text not null default '';

alter table public.print_projects
  add column if not exists last_scanned_at timestamptz;

alter table public.print_project_files
  add column if not exists source_missing boolean not null default false;

alter table public.print_project_files
  add column if not exists source_last_seen_at timestamptz;

update public.print_project_files
set source_missing = false
where source_missing is null;

update public.print_project_files
set source_last_seen_at = created_at
where source_kind = 'folder_scan'
  and source_last_seen_at is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'print_projects_scan_root_name_length_check'
      and conrelid = 'public.print_projects'::regclass
  ) then
    alter table public.print_projects
      add constraint print_projects_scan_root_name_length_check
      check (char_length(scan_root_name) <= 255);
  end if;
end
$$;

create index if not exists print_project_files_source_missing_idx
  on public.print_project_files(user_id, project_id, source_missing)
  where source_kind = 'folder_scan';

commit;
