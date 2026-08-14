# Philamentix Hub V17.2.2 – Release Control & Beta-Tester

## Neu

- globale Versionsanzeige in der linken Sidebar, zentral vom Admin steuerbar
- animierte Roll-Message in der Sidebar
- getrennte Public- und Beta-Version
- getrennte Public- und Beta-Roll-Message
- Beta-Release kann gezielt aktiviert/deaktiviert werden
- Nutzer können im Adminbereich als Beta-Tester freigeschaltet werden
- Beta-Tester sehen bei aktivem Beta-Release zuerst die Beta-Version
- Button **Beta → Public veröffentlichen** übernimmt die Beta-Version für alle Nutzer
- zentrale `hasReleaseAccess("3.4")`-Prüfung für kommende Beta-Funktionen
- Adminänderungen werden im bestehenden Admin-Audit protokolliert
- normale Benutzer dürfen Release- oder Beta-Einstellungen nicht schreiben

## Sicherheit

Die Tabellen verwenden RLS. Angemeldete Benutzer dürfen die globale Release-Konfiguration nur lesen und in `beta_testers` ausschließlich ihren eigenen Status lesen. Änderungen laufen über geschützte Admin-API-Routen mit vorhandener `user_roles`-Prüfung.

## Wichtig

Vor dem ersten Einsatz einmal `supabase/release_channels_v17_2_2.sql` im Supabase SQL Editor ausführen.

Die Bambu-Studio-Bridge bleibt entfernt.
