# Code-Check V15.1

## Erfolgreich geprüft

- 32 TypeScript-/TSX-Dateien auf Parserfehler
- 12 CSS-Dateien mit PostCSS
- 1 JavaScript-Dateien mit `node --check`
- 6 SQL-Dateien auf Transaktionsstruktur
- sämtliche relativen und `@/`-Projektimporte
- Heartbeat-RPC verwendet ausschließlich `auth.uid()`
- Zeitstempel wird serverseitig mit PostgreSQL `now()` gesetzt
- RLS erlaubt Nutzern nur den eigenen Presence-Datensatz
- geschützte Admin-API liest den Online-Status
- Adminseite aktualisiert den Status automatisch alle 20 Sekunden
- Onlinefenster: 75 Sekunden
- keine Seitenpfade, Browserdaten oder IP-Adressen werden gespeichert
- vorhandene Adminrolle, Sperrfunktion, Korrekturen und Auditlogs bleiben erhalten

## Grenze der Prüfung

Das Paket ist ein Update-Overlay ohne das vollständige lokale
`package.json` und den installierten Abhängigkeitsbaum. Der vollständige
Next.js-Produktionsbuild erfolgt deshalb im Gesamtprojekt mit:

`npm.cmd run build`
