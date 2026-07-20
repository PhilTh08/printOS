# Code-Check V15

## Erfolgreich geprüft

- 30 TypeScript-/TSX-Dateien auf Syntax geprüft
- strikte semantische TypeScript-Prüfung mit lokalen Modul-Stubs
- 12 CSS-Dateien mit PostCSS geparst
- vorhandenes ZXing-JavaScript mit `node --check` geprüft
- alle neuen lokalen Imports auf vorhandene Zieldateien geprüft
- alle 6 Admin-API-Routen erzwingen eine serverseitige Adminprüfung
- alle 3 verändernden Admin-Routen verlangen einen Supportgrund
- keine Secret-/Service-Role-Variable wird in einer Client-Komponente verwendet
- keine Secret-Variable besitzt einen `NEXT_PUBLIC_`-Namen
- `user_roles` erlaubt angemeldeten Benutzern nur das Lesen der eigenen Rolle
- Rollenänderungen sind für normale Browserkonten gesperrt
- `admin_action_logs` ist nicht direkt für Browserrollen freigegeben
- Konto-, Filament- und Protokolländerungen erzeugen zuerst einen Audit-Eintrag
- eigener Adminaccount kann nicht über die Oberfläche gesperrt werden
- andere Adminaccounts können nicht versehentlich gesperrt werden
- fehlende Auftragstabelle wird ohne Seitenabsturz behandelt

## Sicherheitsarchitektur

- Browser: normale Publishable-Key-Verbindung mit RLS
- Admin-API: Bearer-Token des angemeldeten Nutzers wird serverseitig validiert
- Adminrolle: wird bei jeder Admin-API-Anfrage aus `public.user_roles` geprüft
- erhöhte Datenbankrechte: ausschließlich in Next.js-Serverrouten über `SUPABASE_SECRET_KEY` oder den Legacy-Schlüssel
- Audit: pending → success/failed mit Vorher-/Nachher-Daten

## Grenze der Prüfung

Das Paket ist ein Update-Overlay ohne `package.json` und ohne den vollständigen installierten Projektbaum. Deshalb konnte hier kein echter `next build` ausgeführt werden. Der abschließende Build erfolgt im kompletten lokalen Projekt mit:

`npm.cmd run build`
