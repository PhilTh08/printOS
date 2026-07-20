# Code-Check V16

## Enthalten

- Auftrag anlegen
- Auftrag bearbeiten
- Kunde / Projekt
- Fälligkeitsdatum
- Notizen
- Statuspflege
- Suche und Filter
- Überfälligkeitsanzeige
- Löschen
- automatische Anzeige im vorhandenen Adminbereich

## Sicherheit

- `orders.user_id` verweist auf `auth.users`
- RLS ist aktiviert
- Select, Insert, Update und Delete sind auf `auth.uid() = user_id`
  begrenzt
- Clientmutationen filtern zusätzlich nach der angemeldeten `user_id`
- anonyme Rollen erhalten keinen Tabellenzugriff
- Adminzugriff erfolgt weiterhin ausschließlich über die geschützte
  serverseitige Admin-API

## Erfolgreich geprüft

- 33 TypeScript-/TSX-Dateien auf Parserfehler
- 13 CSS-Dateien mit PostCSS
- 1 JavaScript-Dateien mit `node --check`
- 7 SQL-Dateien auf Transaktionsstruktur
- alle relativen und `@/`-Projektimporte
- keine nackten globalen Elementselektoren in CSS-Modulen
- Navigation und Auftragsroute
- vier RLS-Policies
- Status-Constraint
- `updated_at`-Trigger
- vorhandene Admin-Order-Abfrage

## Bewusst nicht enthalten

- Filamentzuordnung
- Grammplanung oder Verbrauch
- Bestandsabbuchung
- Rechnungen
- Drucker-Automation
- Backup von Aufträgen

## Abschließender Build

Das Paket ist ein Update-Overlay. Im vollständigen Projekt ausführen:

`npm.cmd run build`
