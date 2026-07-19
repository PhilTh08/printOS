-- Nur ausführen, wenn user_id und RLS noch nicht eingerichtet sind.
-- Das Skript legt keine Beispieldaten an.

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

-- Vor SET NOT NULL müssen vorhandene NULL-Zeilen einem Benutzer zugeordnet sein.
-- Beispiel:
-- update public.filaments set user_id = 'DEINE-USER-UUID' where user_id is null;
-- update public.filament_logs set user_id = 'DEINE-USER-UUID' where user_id is null;

alter table public.filaments
  drop constraint if exists filaments_barcode_key;

create unique index if not exists filaments_user_barcode_unique
  on public.filaments(user_id, barcode);

create index if not exists filaments_user_id_idx
  on public.filaments(user_id);

create index if not exists filament_logs_user_id_idx
  on public.filament_logs(user_id);

alter table public.filaments enable row level security;
alter table public.filament_logs enable row level security;

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
