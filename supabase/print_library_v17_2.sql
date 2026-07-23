-- Philamentix Hub V17.2 – 3D-Viewer, Modellmetadaten und Versionierung
-- Nach V17.1 einmal vollständig im Supabase SQL Editor ausführen.

begin;

alter table public.print_project_files
  add column if not exists generated_preview_path text;

alter table public.print_project_files
  add column if not exists model_width_mm double precision;

alter table public.print_project_files
  add column if not exists model_depth_mm double precision;

alter table public.print_project_files
  add column if not exists model_height_mm double precision;

alter table public.print_project_files
  add column if not exists model_volume_mm3 double precision;

alter table public.print_project_files
  add column if not exists triangle_count bigint;

alter table public.print_project_files
  add column if not exists metadata_extracted_at timestamptz;

alter table public.print_project_files
  add column if not exists version_group_id uuid;

alter table public.print_project_files
  add column if not exists version_number integer not null default 1;

alter table public.print_project_files
  add column if not exists version_note text not null default '';

update public.print_project_files
set version_group_id = gen_random_uuid()
where version_group_id is null;

alter table public.print_project_files
  alter column version_group_id set not null;

alter table public.print_project_files
  alter column version_group_id set default gen_random_uuid();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'print_project_files_model_dimensions_check'
      and conrelid = 'public.print_project_files'::regclass
  ) then
    alter table public.print_project_files
      add constraint print_project_files_model_dimensions_check
      check (
        (model_width_mm is null or model_width_mm >= 0)
        and (model_depth_mm is null or model_depth_mm >= 0)
        and (model_height_mm is null or model_height_mm >= 0)
        and (model_volume_mm3 is null or model_volume_mm3 >= 0)
        and (triangle_count is null or triangle_count >= 0)
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'print_project_files_version_number_check'
      and conrelid = 'public.print_project_files'::regclass
  ) then
    alter table public.print_project_files
      add constraint print_project_files_version_number_check
      check (version_number >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'print_project_files_version_note_length_check'
      and conrelid = 'public.print_project_files'::regclass
  ) then
    alter table public.print_project_files
      add constraint print_project_files_version_note_length_check
      check (char_length(version_note) <= 500);
  end if;
end
$$;

create index if not exists print_project_files_version_group_idx
  on public.print_project_files(user_id, project_id, version_group_id, version_number desc);

commit;
