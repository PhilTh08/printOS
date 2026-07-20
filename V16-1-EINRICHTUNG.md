# V16.1 einrichten

## Enthalten

- Passwort beim Login, Passwort-Reset und im Profil anzeigen oder ausblenden
- dauerhaftes Löschen des eigenen Benutzerkontos
- vollständiges Backup als CSV
- Wiederherstellung aus CSV
- Aufträge im vollständigen Backup
- separater CSV-Export auf der Auftragsseite

## Datenbank

Für V16.1 ist keine zusätzliche SQL-Migration nötig.

Das Auftragssystem aus V16 muss bereits eingerichtet sein:

`supabase/orders.sql`

## Server-Schlüssel

Die Kontolöschung verwendet dieselbe sichere Servervariable wie das
Adminsystem:

`SUPABASE_SECRET_KEY`

Alternativ funktioniert weiterhin:

`SUPABASE_SERVICE_ROLE_KEY`

Der Schlüssel darf niemals mit `NEXT_PUBLIC_` beginnen.

## Installation

ZIP in das Projekt entpacken und vorhandene Dateien ersetzen.

Danach:

```powershell
npm.cmd run build
```

Bei Erfolg:

```powershell
git add .
git commit -m "Kontoloeschung und CSV Backup ergänzt"
git push
```

## CSV-Verhalten

Ein vollständiges Backup enthält:

- Filamente
- Protokolle
- Aufträge

Ein Export auf der Auftragsseite enthält ausschließlich Aufträge. Beim
Import erkennt Philamentix den Umfang über die Metadaten der CSV-Datei:

- Vollständiges Backup ersetzt Filamente, Protokolle und Aufträge
- Auftrags-Export ersetzt nur Aufträge

Die Datei verwendet UTF-8 mit BOM und RFC-4180-kompatible Anführungszeichen,
damit Umlaute, Kommas und Zeilenumbrüche erhalten bleiben.
