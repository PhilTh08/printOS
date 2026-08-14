# V17.2.2.5 – Roll-Message-Geschwindigkeit

1. Patch direkt nach `C:\Projekte\printos-filamentlager` entpacken und vorhandene Dateien ersetzen.
2. In Supabase → SQL Editor `supabase/roll_message_speed_v17_2_5.sql` einmal vollständig ausführen.
3. `npm.cmd run build` ausführen.
4. Danach committen und pushen.

Im Adminbereich gibt es bei der Public-Roll-Message nur ein zusätzliches kompaktes Dropdown. Die Auswahl gilt global für Public- und Beta-Roll-Messages:

- Schnell · 18 s
- Normal · 26 s
- Langsam · 34 s
- Sehr langsam · 45 s

Standard ist `Normal`.
