-- Philamentix Hub V17.2.2.5 – Admin-einstellbare Roll-Message-Geschwindigkeit
-- Nach release_channels_v17_2_2.sql einmal im Supabase SQL Editor ausführen.

begin;

alter table public.app_release_state
  add column if not exists roll_message_speed text not null default 'normal';

update public.app_release_state
set roll_message_speed = 'normal'
where roll_message_speed not in ('fast', 'normal', 'slow', 'very_slow');

alter table public.app_release_state
  drop constraint if exists app_release_state_roll_message_speed_check;

alter table public.app_release_state
  add constraint app_release_state_roll_message_speed_check
  check (roll_message_speed in ('fast', 'normal', 'slow', 'very_slow'));

commit;
