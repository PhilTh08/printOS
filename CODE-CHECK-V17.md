# Code-Check V17.0

## Geprüft

- 36 TypeScript-/TSX-Dateien auf Parserfehler
- 14 CSS-Dateien mit PostCSS
- lokale relative und `@/`-Importe
- keine nackten globalen Elementselektoren in CSS-Modulen
- Navigation zur Druckbibliothek
- RLS für Projekte und Dateien
- privater Supabase-Storage-Bucket
- Storage-Pfade beginnen mit der angemeldeten `user_id`
- alle Clientmutationen filtern zusätzlich nach `user_id`
- erlaubte Dateiendungen und Dateigröße bis 100 MB
- Rollback von Storage und Metadaten bei fehlgeschlagenem Mehrfachupload
- Projektlöschung entfernt zugehörige Storage-Objekte
- Bilddateien können als Projektvorschau gesetzt werden

## Sicherheit

- keine öffentlichen Storage-URLs
- Vorschaubilder werden nur als zeitlich begrenzte Signed URLs geladen
- Downloadlinks laufen ebenfalls über zeitlich begrenzte Signed URLs
- Tabellen und Storage-Objekte sind durch RLS pro Nutzer getrennt
- Projekt- und Datei-IDs werden nicht als Besitznachweis verwendet; jede Mutation
  prüft zusätzlich die angemeldete `user_id`
- Dateinamen werden vor dem Storage-Upload normalisiert

## Noch nicht vollständig geprüft

Das Paket ist weiterhin ein Update-Overlay und enthält kein `package.json` sowie
keine installierten Abhängigkeiten. Deshalb konnte in dieser Umgebung kein
vollständiger Next.js-Produktionsbuild oder echter Browser-Upload gegen dein
Supabase-Projekt ausgeführt werden.

Im vollständigen lokalen Projekt ausführen:

`npm.cmd run build`
