# Philamentix Hub V17.1 – Ordner-Scanner

## Einmalige Datenbank-Migration

Wenn V17.0 bereits eingerichtet ist:

1. Supabase öffnen
2. SQL Editor öffnen
3. den vollständigen Inhalt von `supabase/print_library_v17_1.sql` einfügen
4. **Run** klicken

Die vorhandenen Projekte und Dateien bleiben erhalten.

Bei einer komplett neuen Installation reicht der aktualisierte Inhalt von:

`supabase/print_library.sql`

## Neue Funktionen

- lokalen Ordner bewusst im Browser auswählen
- gesamte Unterordnerstruktur rekursiv durchsuchen
- Formate einzeln aktivieren oder deaktivieren
- Suche und Formatfilter innerhalb der Scanergebnisse
- Dateipfade, Größe und Importfähigkeit prüfen
- ignorierte Dateien mit Pfad, Endung, Größe und Grund anzeigen
- markierte Dateien in ein neues oder vorhandenes Projekt importieren
- unveränderte Dateien beim erneuten Scan überspringen
- geänderte Dateien mit gleichem relativem Pfad ersetzen
- Importfortschritt anzeigen
- maximal 250 Dateien und 1 GB pro Import
- maximal 100 MB pro einzelner Datei

## Erkannte Formate

### 3D-Modelle

STL, 3MF, OBJ, PLY und AMF

### Druckdateien

G-Code, BG-Code, Chitubox, CTB und GOO

### CAD

STEP, STP, F3D, FCSTD, SCAD, IGES, IGS und DXF

### Referenzen

JPG, JPEG, PNG, WebP, GIF, SVG, BMP, PDF, TXT und Markdown

### Archive

ZIP

## Datenschutz

Beim Scan verbleiben Dateiinhalte lokal im Browser. Erst nach dem Klick auf
„Auswahl importieren“ werden die markierten Dateien in den privaten
Supabase-Storage des angemeldeten Benutzers übertragen.

Eine Website kann nicht selbstständig beliebige Ordner des Computers lesen.
Der Benutzer muss den Ordner bei jedem Scan bewusst auswählen.

## Installation

ZIP in das bestehende Projekt entpacken und Dateien ersetzen.

Danach:

```powershell
npm.cmd run build
```

Bei Erfolg:

```powershell
git add .
git commit -m "Lokalen Ordner Scanner V17.1 ergänzt"
git push
```
