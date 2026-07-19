# Code-Check V14.4

## Erfolgreich geprüft

- 21 TypeScript-/TSX-Dateien:
  - Parser-/Transpile-Diagnostik
  - strikte semantische TypeScript-Prüfung mit lokalen Modul-Stubs
- 11 CSS-Dateien mit PostCSS geparst
- 1 JavaScript-Dateien mit `node --check` geprüft
- 4 SQL-Dateien auf Transaktionsstruktur geprüft
- alle relativen und `@/`-Projektimporte auf vorhandene Zieldateien geprüft
- Bildmodus wird in Filamentübersicht und Detailansicht verwendet
- persönliche Preference-Abfragen sind mit `user_id` eingeschränkt
- neue Tabelle `user_preferences` besitzt Row Level Security
- bestehende Rot-/Orange-/Grün-Bestandsampel bleibt aktiv

## Verhalten bei fehlender Migration

Fehlt `user_preferences`, bleibt die gewählte Darstellung im jeweiligen
Browser erhalten. Die App und die Filamentverwaltung funktionieren weiter.

## Grenze der Prüfung

Das Paket ist weiterhin ein Update-Overlay und enthält kein `package.json`
sowie keinen vollständigen `node_modules`-Projektbaum. Deshalb wurde hier
kein vollständiger `next build` ausgeführt. Der abschließende Build erfolgt
im vollständigen lokalen Projekt mit:

`npm.cmd run build`
