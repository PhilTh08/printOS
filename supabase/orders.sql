-- Philamentix Hub V16 – minimales Auftragssystem
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

create extension if not exists pgcrypto;

create table if not exists public.orders (
  id uuid primary key
    default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  title text not null
    check (
      char_length(trim(title))
      between 1 and 200
    ),
  customer_name text not null
    default ''
    check (
      char_length(customer_name)
      <= 200
    ),
  status text not null
    default 'open'
    check (
      status in (
        'open',
        'in_progress',
        'completed',
        'cancelled'
      )
    ),
  due_date date,
  notes text not null
    default ''
    check (
      char_length(notes) <= 5000
    ),
  created_at timestamptz not null
    default now(),
  updated_at timestamptz not null
    default now()
);

create index if not exists
  orders_user_created_idx
on public.orders (
  user_id,
  created_at desc
);

create index if not exists
  orders_user_status_idx
on public.orders (
  user_id,
  status
);

create index if not exists
  orders_user_due_date_idx
on public.orders (
  user_id,
  due_date
);

alter table public.orders
  enable row level security;

drop policy if exists
  "Users read own orders"
  on public.orders;

drop policy if exists
  "Users insert own orders"
  on public.orders;

drop policy if exists
  "Users update own orders"
  on public.orders;

drop policy if exists
  "Users delete own orders"
  on public.orders;

create policy
  "Users read own orders"
on public.orders
for select
to authenticated
using (
  (select auth.uid()) = user_id
);

create policy
  "Users insert own orders"
on public.orders
for insert
to authenticated
with check (
  (select auth.uid()) = user_id
);

create policy
  "Users update own orders"
on public.orders
for update
to authenticated
using (
  (select auth.uid()) = user_id
)
with check (
  (select auth.uid()) = user_id
);

create policy
  "Users delete own orders"
on public.orders
for delete
to authenticated
using (
  (select auth.uid()) = user_id
);

revoke all
on table public.orders
from anon;

grant select, insert, update, delete
on table public.orders
to authenticated;

grant all
on table public.orders
to service_role;

create or replace function
  public.set_order_updated_at()
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

drop trigger if exists
  orders_set_updated_at
on public.orders;

create trigger
  orders_set_updated_at
before update
on public.orders
for each row
execute function
  public.set_order_updated_at();

commit;
