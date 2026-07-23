-- Philamentix Hub V17.1 – Migration für bestehende V17.0-Installationen
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

alter table public.print_project_files
  add column if not exists relative_path text not null default '';

alter table public.print_project_files
  add column if not exists source_modified_at timestamptz;

alter table public.print_project_files
  add column if not exists source_kind text not null default 'upload';

update public.print_project_files
set relative_path = file_name
where relative_path = '';

update public.print_project_files
set source_kind = 'upload'
where source_kind not in ('upload', 'folder_scan');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'print_project_files_relative_path_length_check'
      and conrelid = 'public.print_project_files'::regclass
  ) then
    alter table public.print_project_files
      add constraint print_project_files_relative_path_length_check
      check (char_length(relative_path) <= 1000);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'print_project_files_source_kind_check'
      and conrelid = 'public.print_project_files'::regclass
  ) then
    alter table public.print_project_files
      add constraint print_project_files_source_kind_check
      check (source_kind in ('upload', 'folder_scan'));
  end if;
end
$$;

create index if not exists print_project_files_relative_path_idx
  on public.print_project_files(user_id, project_id, relative_path);

commit;
