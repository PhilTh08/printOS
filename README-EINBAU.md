# Philamentix Hub – modulare Seiten

## Neue Routen

- `/` – Anmeldung
- `/dashboard`
- `/statistiken`
- `/ein-auslagern`
- `/filamente`
- `/filamente/neu`
- `/filamente/[id]`
- `/protokoll`
- `/profil`
- `/einstellungen`

Jede Kategorie besitzt eine eigene `page.tsx` und eine eigene
`page.module.css`. Änderungen an einer Kategorie erfolgen deshalb
direkt im jeweiligen Ordner.

## Wichtig

Die bisherige große `app/page.tsx` wird durch die neue Login-Seite
ersetzt. Die eigentliche App liegt anschließend im Route-Group-Ordner:

`app/(hub)/...`

Der Ordnername `(hub)` erscheint nicht in der URL.

Die bisherigen Beispieldaten und die LocalStorage-Übernahme wurden
vollständig entfernt. Beim Aktualisieren werden daher keine
Beispielfilamente mehr angelegt.

Die Datei `lib/supabase.ts`, dein PWA-Layout, Manifest, Service Worker
und Icons bleiben unverändert bestehen.

## Einbau

Kopiere den Inhalt dieses Pakets in den Projektordner und ersetze die
vorhandenen Dateien. Lösche anschließend eine eventuell vorhandene
Datei `lib/filament-presets.ts`.

Führe danach zuerst lokal aus:

`npm.cmd run build`
