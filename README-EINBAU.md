# Philamentix Hub – Industrial Modular V2

Diese Version stellt das bisherige Industrial-Design wieder her und behält trotzdem getrennte Next.js-Routen.

## Enthaltene Routen

- `/` Anmeldung, Registrierung und Passwort-Reset
- `/dashboard`
- `/statistiken` inklusive Bewegungsdiagramm, Herstellerverteilung, Ranglisten und Materialdetails
- `/ein-auslagern`
- `/filamente`
- `/filamente/neu`
- `/filamente/[id]` für jeden einzelnen Filament-Datensatz
- `/protokoll`
- `/profil`
- `/einstellungen`

## Behobener Fehler

Es gibt keine Beispieldaten, keine Presets und keine LocalStorage-Migration mehr. Beim Aktualisieren einer Seite werden ausschließlich die Supabase-Daten des angemeldeten Benutzers geladen. Dadurch werden beim Neuladen des Profils keine Filamente mehr automatisch hinzugefügt.

## Dateien kopieren

Den Inhalt der ZIP direkt nach folgendem Ordner entpacken:

`C:\Projekte\printos-filamentlager`

Vorhandene Dateien ersetzen. Das vorhandene `app/layout.tsx`, die PWA-Dateien, `lib/supabase.ts`, Manifest, Icons und Service Worker bleiben bestehen.

Eine alte Datei `lib/filament-presets.ts` kann gelöscht werden.

## Design und spätere Anpassungen

Das gemeinsame Industrial-Grunddesign liegt in `app/globals.css`.

Jede Kategorie hat zusätzlich eine eigene:

- `page.tsx`
- `page.module.css`

Funktion und Inhalt einer Kategorie werden nur in ihrem Ordner geändert. Gemeinsame Navigation und Datenzugriff liegen unter `components/philamentix`.

## Test

`npm.cmd run build`

Erst nach einem erfolgreichen Build committen und pushen.

## Änderung in V3

In der Filamentübersicht gibt es wieder einen direkten Löschen-Button.
Der Button löscht nur das Filament des angemeldeten Benutzers und zeigt
vorher eine Sicherheitsabfrage an.


## Ergänzungen in V4

- Die Sidebar bleibt auf Desktop dauerhaft im sichtbaren Bereich.
- Bei sehr vielen Navigationseinträgen scrollt nur die Sidebar selbst.
- Nach dem Anlegen eines Filaments erscheint eine Erfolgsanimation.
- Danach wird automatisch die individuelle Filamentseite geöffnet.
- Das Bewegungsdiagramm baut sich beim Öffnen der Statistik von unten nach oben auf.
- Beim Wechsel des Statistikzeitraums wird die Diagrammanimation erneut abgespielt.
