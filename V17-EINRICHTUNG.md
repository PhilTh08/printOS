# Philamentix Hub V17.0 – Druckbibliothek

## Enthalten

- eigener Menüpunkt **Druckbibliothek**
- Druckprojekte anlegen und bearbeiten
- frei benennbare Ordner
- Tags und Favoriten
- Suche nach Projektname, Ordner, Tags und Beschreibung
- Upload mehrerer Dateien
- unterstützte Formate: STL, 3MF, OBJ, G-Code, BG-Code, STEP, STP,
  ZIP, PNG, JPG, WEBP, PDF, TXT und Markdown
- private Speicherung in Supabase Storage
- Vorschaubilder aus hochgeladenen Bildern
- Download und Löschen einzelner Dateien
- vollständiges Löschen eines Projekts inklusive Storage-Dateien
- strikte Trennung aller Daten nach `user_id`
- responsive Darstellung für Desktop, Tablet und Mobilgerät

## Einmalige Supabase-Einrichtung

1. Supabase öffnen.
2. **SQL Editor** öffnen.
3. Den vollständigen Inhalt von `supabase/print_library.sql` einfügen.
4. **Run** drücken.

Das Skript erstellt:

- `public.print_projects`
- `public.print_project_files`
- den privaten Bucket `print-library`
- Tabellen-RLS
- Storage-RLS
- Indizes und `updated_at`-Trigger

Erwartete Meldung:

`Success. No rows returned`

## Installation

Das ZIP in das bestehende Projekt entpacken und vorhandene Dateien ersetzen.

```powershell
npm.cmd run build
```

Bei erfolgreichem Build:

```powershell
git add .
git commit -m "Druckbibliothek V17 ergänzt"
git push
```

## Grenzen von V17.0

Noch nicht enthalten:

- interaktiver 3D-Viewer
- automatische STL-/3MF-Metadaten
- Verknüpfung mit Aufträgen
- Filament- und Grammplanung
- Versionierung eines Modells
- Freigaben zwischen Benutzern
- automatische Aufnahme der Binärdateien in das CSV-Backup

Diese Punkte sind für spätere V17.x-Stufen vorgesehen.
