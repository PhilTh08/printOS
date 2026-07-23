# Philamentix Hub V17.1 – Fertige Übergabe

## Fertiggestellt

- lokaler Ordner-Scanner mit bewusster Ordnerauswahl
- rekursive Erkennung der Unterordnerstruktur
- konfigurierbare Formatgruppen
- Trefferliste mit Suche, Filter, Auswahl und Seitenaufteilung
- separate, aufklappbare Liste ignorierter Dateien
- Import in ein neues oder vorhandenes Druckprojekt
- unveränderte Dateien werden übersprungen
- geänderte Dateien mit gleichem relativem Pfad werden ersetzt
- privater Upload erst nach ausdrücklicher Importbestätigung
- Fortschrittsanzeige und Rollback für neue Uploads bei Fehlern
- Supabase-Migration für bestehende V17.0-Installationen

## Installation

1. Sicherheitskopie des bestehenden Projekts erstellen.
2. Dieses ZIP im Projektordner entpacken und vorhandene Dateien ersetzen.
3. In Supabase `supabase/print_library_v17_1.sql` vollständig ausführen.
4. Im Projektordner `npm.cmd run build` ausführen.
5. Nach erfolgreichem Build deployen.

## Datenschutz

Beim Auswählen eines Ordners werden Dateinamen, relative Pfade, Größen und Änderungszeiten lokal im Browser ausgewertet. Dateiinhalte werden erst durch „Auswahl importieren“ in den privaten Supabase-Storage des angemeldeten Nutzers übertragen.

## Geprüfter Paketstand

- 37 TypeScript-/TSX-Dateien ohne Parserfehler
- 14 CSS-Dateien erfolgreich geparst
- 9 SQL-Dateien mit Transaktionsstruktur geprüft
- Scanner-Test für rekursive Pfade, erkannte Dateien, ignorierte Dateien und Größenlimit bestanden
