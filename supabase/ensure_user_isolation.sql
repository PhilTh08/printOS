begin;

alter table public.filaments
  add column if not exists user_id uuid
  references auth.users(id)
  on delete cascade;

alter table public.filament_logs
  add column if not exists user_id uuid
  references auth.users(id)
  on delete cascade;

alter table public.filaments
  alter column user_id set default auth.uid();

alter table public.filament_logs
  alter column user_id set default auth.uid();

do $$
begin
  if exists (
    select 1
    from public.filaments
    where user_id is null
  ) then
    raise exception
      'Es gibt Filamente ohne user_id. Ordne diese zuerst einem Benutzer zu.';
  end if;

  if exists (
    select 1
    from public.filament_logs
    where user_id is null
  ) then
    raise exception
      'Es gibt Protokolle ohne user_id. Ordne diese zuerst einem Benutzer zu.';
  end if;
end
$$;

alter table public.filaments
  alter column user_id set not null;

alter table public.filament_logs
  alter column user_id set not null;

alter table public.filaments
  drop constraint if exists filaments_barcode_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'filaments_user_barcode_key'
  ) then
    alter table public.filaments
      add constraint filaments_user_barcode_key
      unique (user_id, barcode);
  end if;
end
$$;

create index if not exists filaments_user_id_idx
  on public.filaments(user_id);

create index if not exists filament_logs_user_id_idx
  on public.filament_logs(user_id);

do $$
declare
  policy_record record;
begin
  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'filaments'
  loop
    execute format(
      'drop policy if exists %I on public.filaments',
      policy_record.policyname
    );
  end loop;

  for policy_record in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'filament_logs'
  loop
    execute format(
      'drop policy if exists %I on public.filament_logs',
      policy_record.policyname
    );
  end loop;
end
$$;

alter table public.filaments enable row level security;
alter table public.filament_logs enable row level security;

create policy "Users read own filaments"
on public.filaments
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert own filaments"
on public.filaments
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update own filaments"
on public.filaments
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete own filaments"
on public.filaments
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users read own logs"
on public.filament_logs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert own logs"
on public.filament_logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users delete own logs"
on public.filament_logs
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
