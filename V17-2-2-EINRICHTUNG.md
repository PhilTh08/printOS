# V17.2.2 einrichten

## 1. Dateien kopieren

Den Inhalt dieses ZIP direkt nach

`C:\Projekte\printos-filamentlager`

entpacken und vorhandene Dateien ersetzen.

## 2. Supabase-Migration ausführen

Im Supabase Dashboard den SQL Editor öffnen und die Datei

`supabase/release_channels_v17_2_2.sql`

vollständig ausführen.

Dadurch entstehen:

- `public.app_release_state`
- `public.beta_testers`
- passende RLS-Regeln

## 3. Build prüfen

Im Projektordner:

```powershell
npm.cmd run build
```

## 4. Adminbereich

Unter `/admin` befindet sich oben **Release Control**.

Dort kannst du:

- Public-Kanal und Public-Version setzen, z. B. `PROD // 1.1`
- eine globale Roll-Message aktivieren
- Beta-Kanal und Beta-Version vorbereiten, z. B. `BETA // 3.4`
- Beta-Release aktivieren
- Nutzer links auswählen und mit **Beta freischalten** zu Testern machen
- nach dem Test mit **Beta → Public veröffentlichen** die Beta-Version für alle freigeben

## Beta-Features in zukünftigen Versionen

Der zentrale Hub-Context stellt `hasReleaseAccess(requiredVersion)` bereit.

Beispiel: Ein neues Feature wird für Version `3.4` gebaut. Beta-Tester auf Beta 3.4 erhalten Zugriff, während normale Nutzer auf Public 1.1 es noch nicht sehen. Wird 3.4 veröffentlicht, erfüllt anschließend auch Public die Mindestversion.

## 5. Deployment

Nach erfolgreichem Build:

```powershell
git add .
git commit -m "Add release control and beta testers"
git push
```
