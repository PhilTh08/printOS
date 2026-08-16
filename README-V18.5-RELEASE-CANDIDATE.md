# Philamentix Hub V18.5 – Release Candidate

## Adminbereich

Die Admin-Leiste enthält jetzt:

- Benutzer
- Release
- Wartung
- System
- Release Center
- System-Log
- Systemstatus

Release Center, System-Log und Systemstatus sind bewusst nur im Adminbereich erreichbar und nicht doppelt in der Haupt-Sidebar.

## Systemstatus

`/admin/status` aktualisiert sich automatisch alle 10 Sekunden und prüft:

- Philamentix Admin-API / Admin-Authentifizierung
- Supabase Datenbank
- Release-Center-Datenbank
- System-Log-Datenbank
- GitHub Release API
- Vercel Deployment API

Zusätzlich werden die letzten Vercel Deployments mit Status, Branch, Commit-Nachricht und Link angezeigt.

### Statusfarben

- Grün: alles OK
- Gelb: Hub läuft, aber ein Zusatzdienst meldet Fehler / Warnung
- Rot: kritischer Dienst nicht verfügbar

## Vercel Live-Deployments aktivieren

Als geheime Environment Variable hinzufügen:

`VERCEL_API_TOKEN`

für Production und den V18.5 Preview-Branch.

Optional:

- `VERCEL_PROJECT_ID` (Standard ohne Variable: `print-os`)
- `VERCEL_TEAM_ID` (nur nötig, wenn der Token explizit einem Team zugeordnet werden muss)

Nach Änderung der Environment Variables das Preview Deployment neu deployen.
