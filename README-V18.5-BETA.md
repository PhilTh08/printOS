# Philamentix Hub V18.5 BETA – Admin Release Center

## Neu

- Eigener Adminbereich **Release Center**
- Drei Release-Stufen: **Production → Beta → Public**
- ZIP-Updatepakete direkt im Adminpanel hochladen
- GitHub-Commit aus dem Adminpanel
- Release-Historie mit Version, Kanal, Commit und Fehlerstatus
- Eigener **System-Log** im Adminbereich
- Zentrale Datenbank-Trigger für Änderungen an Lager, Aufträgen, Druckbibliothek und Produktion
- Bestehendes Admin-Audit bleibt erhalten und wird im System-Log zusammengeführt

## Einmalige Einrichtung

### 1. Supabase

`supabase/release_center_v18_5.sql` vollständig im SQL Editor ausführen.

### 2. Vercel

Folgende Environment Variable setzen:

- `GITHUB_RELEASE_TOKEN` – GitHub Fine-Grained Token mit Schreibzugriff auf `PhilTh08/printOS`
- optional `GITHUB_RELEASE_REPO` – Standard ist bereits `PhilTh08/printOS`

Empfohlene GitHub-Rechte für den Token:

- Repository contents: Read and write
- Metadata: Read

## Release-Workflow

1. Updatepaket im Adminbereich als **Production** hochladen.
2. Intern/Preview testen.
3. Mit **Production → Beta** für Beta-Tester freigeben.
4. Nach erfolgreichem Test mit **Beta → Public** veröffentlichen.

Production ist bewusst der erste interne Stand und wird Beta-Testern nicht automatisch freigeschaltet.

## Updatepakete

- ZIP
- maximal 15 MB
- maximal 200 Dateien
- keine `.env`, `.git`, `node_modules` oder `.next` Inhalte
- Dateien liegen im ZIP relativ zum Projekt-Root, z. B. `app/(hub)/produktion/page.tsx`

## Hinweis zu Vercel

GitHub-Branches können über die bestehende Vercel-Git-Integration als Preview deployed werden. `main` bleibt der Public-/Production-Deployment-Branch der bestehenden Installation, solange die Vercel-Projekteinstellungen nicht geändert werden.
