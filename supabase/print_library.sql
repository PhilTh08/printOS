-- Philamentix Hub V17.0 – Druckbibliothek
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

create extension if not exists pgcrypto;

create table if not exists public.print_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 200),
  folder text not null default '' check (char_length(folder) <= 120),
  description text not null default '' check (char_length(description) <= 5000),
  tags text[] not null default '{}'::text[],
  favorite boolean not null default false,
  cover_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.print_project_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.print_projects(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_type text not null check (char_length(file_type) <= 24),
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  is_preview boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists print_projects_user_updated_idx
  on public.print_projects(user_id, updated_at desc);
create index if not exists print_projects_user_folder_idx
  on public.print_projects(user_id, folder);
create index if not exists print_project_files_project_idx
  on public.print_project_files(project_id, created_at desc);
create index if not exists print_project_files_user_idx
  on public.print_project_files(user_id);

alter table public.print_projects enable row level security;
alter table public.print_project_files enable row level security;

drop policy if exists "Users read own print projects" on public.print_projects;
drop policy if exists "Users insert own print projects" on public.print_projects;
drop policy if exists "Users update own print projects" on public.print_projects;
drop policy if exists "Users delete own print projects" on public.print_projects;

create policy "Users read own print projects"
  on public.print_projects for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users insert own print projects"
  on public.print_projects for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "Users update own print projects"
  on public.print_projects for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete own print projects"
  on public.print_projects for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users read own print files" on public.print_project_files;
drop policy if exists "Users insert own print files" on public.print_project_files;
drop policy if exists "Users update own print files" on public.print_project_files;
drop policy if exists "Users delete own print files" on public.print_project_files;

create policy "Users read own print files"
  on public.print_project_files for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "Users insert own print files"
  on public.print_project_files for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.print_projects project
      where project.id = project_id
        and project.user_id = (select auth.uid())
    )
  );
create policy "Users update own print files"
  on public.print_project_files for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Users delete own print files"
  on public.print_project_files for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.print_projects from anon;
revoke all on table public.print_project_files from anon;
grant select, insert, update, delete on table public.print_projects to authenticated;
grant select, insert, update, delete on table public.print_project_files to authenticated;
grant all on table public.print_projects to service_role;
grant all on table public.print_project_files to service_role;

create or replace function public.set_print_project_updated_at()
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

drop trigger if exists print_projects_set_updated_at on public.print_projects;
create trigger print_projects_set_updated_at
before update on public.print_projects
for each row execute function public.set_print_project_updated_at();

-- Privater Storage-Bucket. 100 MB pro Datei.
insert into storage.buckets (id, name, public, file_size_limit)
values ('print-library', 'print-library', false, 104857600)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Users read own print library objects" on storage.objects;
drop policy if exists "Users upload own print library objects" on storage.objects;
drop policy if exists "Users update own print library objects" on storage.objects;
drop policy if exists "Users delete own print library objects" on storage.objects;

create policy "Users read own print library objects"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'print-library'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users upload own print library objects"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'print-library'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users update own print library objects"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'print-library'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'print-library'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Users delete own print library objects"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'print-library'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

commit;
