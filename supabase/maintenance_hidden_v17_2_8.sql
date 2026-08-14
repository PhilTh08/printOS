-- Philamentix Hub V17.2.8 – Bereiche ausblenden
-- Einmal vollständig im Supabase SQL Editor ausführen.

begin;

alter table public.maintenance_rules
  drop constraint if exists maintenance_rules_mode_check;

alter table public.maintenance_rules
  add constraint maintenance_rules_mode_check
  check (mode in ('maintenance', 'available', 'hidden'));

commit;
