-- Philamentix Hub V13
-- Einmal im Supabase SQL Editor ausführen.
-- Ergänzt ein optionales Bild pro persönlichem Filament.

begin;

alter table public.filaments
  add column if not exists image_url text
  not null default '';

commit;
