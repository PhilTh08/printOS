# Code-Check V17.0.1 – Demo-Modus entfernt

## Entfernt

- verbliebener Gast-Schlüssel `philamentix-dashboard-widgets-guest`
- lokales Dashboard-Verhalten ohne angemeldeten Benutzer
- veraltete statische Design-/Demo-Datei `DESIGNVORSCHLAG-V15.2.html`

## Verhalten danach

- alle Hub-Seiten setzen eine gültige Supabase-Sitzung voraus
- ohne Sitzung erfolgt ausschließlich die Weiterleitung zur Anmeldung
- Widget-Einstellungen werden nur einem echten Benutzerkonto zugeordnet
- es werden keine Demo-, Gast- oder Beispieldaten erzeugt

## Prüfung

- Quellcode-Suche nach Demo-, Mock-, Seed- und Gastmodus
- TypeScript-/TSX-Parserprüfung
- CSS-Parserprüfung
- lokale Importprüfung
- CSS-Module auf unzulässige globale Selektoren geprüft

Für den vollständigen Produktionsbuild im kompletten Projekt:

`npm.cmd run build`
