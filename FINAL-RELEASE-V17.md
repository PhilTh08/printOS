# Philamentix Hub – Final Release V17

## Neu in diesem Paket

- Adminbereich zeigt bei Kundenaufträgen dieselben vier Übersichtskacheln wie die Nutzeransicht:
  - Offen
  - In Arbeit
  - Überfällig
  - Erledigt
- Überfällige Aufträge werden anhand des Fälligkeitsdatums und Status berechnet.
- Alte oder unvollständige Auftragsdatensätze werden defensiv behandelt.
- Kacheln sind responsiv für Desktop, Tablet und Mobilgeräte.

## Installation

Overlay in das vollständige Projekt entpacken und vorhandene Dateien ersetzen.

```powershell
npm.cmd run build
git add .
git commit -m "Admin Auftragskacheln und finalen Release ergänzt"
git push
```

## Datenbank

Keine zusätzliche SQL-Migration erforderlich. `supabase/orders.sql` muss bereits ausgeführt sein.
