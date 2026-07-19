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


## Ergänzungen in V5

- Kamera-Barcodescanner nur in der mobilen Ansicht.
- Desktop zeigt weiterhin ausschließlich die vorhandene manuelle Scanner-Eingabe.
- Rückkamera mit automatischer EAN-Erkennung.
- Taschenlampen-Schalter, wenn das Gerät ihn unterstützt.
- Unbekannte EAN öffnet weiterhin das persönliche Formular zum Anlegen.
- Kamera wird beim Verlassen der Seite automatisch beendet.
- Manuelle Barcode-Eingabe bleibt als Fallback sichtbar.


## Safari-Korrektur in V6

Safari auf iPhone stellt die experimentelle `BarcodeDetector`-API
standardmäßig nicht bereit. V6 verwendet deshalb einen lokal
mitgelieferten ZXing-Scanner als Safari-kompatible Erkennung.

Es muss kein zusätzliches npm-Paket installiert werden. Die benötigte
Browserdatei liegt unter:

`public/vendor/zxing-browser.min.js`

Nach dem Einbau die Website neu deployen. Auf dem iPhone anschließend
die alte PWA vollständig schließen und erneut öffnen. Bei einer
installierten PWA kann es zusätzlich helfen, sie einmal vom Home-
Bildschirm zu entfernen und nach dem Deployment neu zu installieren.


## Ergänzungen in V7 – Nachbestellseite

Neue Route:

`/nachbestellen`

Enthalten:

- automatische Liste für Bestand kleiner oder gleich Mindestbestand
- Suche nach Hersteller, Material, Farbe, Barcode, ID und Lagerplatz
- Filter für leere, unterschrittene und genau erreichte Bestände
- Kennzahlen für kritische und knappe Filamente
- empfohlene Bestellmenge
- direkter Bestelllink, sofern beim Filament hinterlegt
- direkter Sprung zum Eintragen eines fehlenden Bestelllinks
- roter Zähler in der Navigation
- Dashboard-Verknüpfung zur Nachbestellseite
- responsive Darstellung für Smartphone und Desktop

Es sind keine Änderungen an Supabase erforderlich.


## Ergänzungen in V8

- Dashboard zeigt die drei dringendsten Nachbestellungen.
- Leere Filamente werden zuerst priorisiert.
- Danach wird nach größter Fehlmenge und niedrigstem Bestand sortiert.
- Empfohlene Bestellmenge wird direkt angezeigt.
- Alle grünen Seiten-Statuspunkte pulsieren jetzt dezent sichtbar.
- Keine Supabase-Änderungen erforderlich.


## Ergänzungen in V9

- Materialverteilung vollständig aus dem Dashboard entfernt.
- Dashboard komplett neu strukturiert.
- Neue Schnellzugriffe für Scanner, Filamente, Nachbestellen und Statistiken.
- Neue Lagergesundheitsanzeige mit Prozentwert und Bestandsstatus.
- Dringende Nachbestellungen und letzte Bewegungen neu gestaltet.
- Nachbestellseite besitzt pro Filament eine Bestellmengenwahl mit Minus- und Plus-Button.
- Bestellmenge ist zwischen 1 und 99 Rollen einstellbar.
- Die Kennzahl „Empfohlene Rollen“ reagiert direkt auf die gewählten Mengen.
- Keine Supabase-Änderungen erforderlich.


## Ergänzungen in V10

### Anpassbares Widget-Dashboard

- Dashboard ist standardmäßig deutlich ruhiger.
- Widgets können ein- und ausgeblendet werden.
- Reihenfolge kann mit Pfeiltasten geändert werden.
- Jedes Widget kann halbe oder volle Breite erhalten.
- Einstellungen werden pro Benutzer lokal im Browser gespeichert.
- Standardansicht kann jederzeit wiederhergestellt werden.
- Verfügbare Widgets:
  - Schnellzugriffe
  - Lagerübersicht
  - Lagergesundheit
  - Dringend nachbestellen
  - Letzte Bewegungen

### Backup-Bereich verschoben

- Daten exportieren und importieren wurde vollständig aus der Sidebar entfernt.
- Beide Funktionen befinden sich jetzt unter `/einstellungen`.
- Einstellungen zeigen zusätzlich die Anzahl der Filamente und Protokolleinträge.
- Die bisherige Sicherheitsabfrage beim Import bleibt erhalten.
- Keine Supabase-Änderungen erforderlich.


## Ergänzungen in V11 – Widget-Bibliothek

- Widgets werden jetzt vollständig aus dem Dashboard entfernt.
- Entfernte Widgets erscheinen nur noch in der Widget-Bibliothek.
- Widgets können jederzeit wieder hinzugefügt werden.
- Reihenfolge und Breite bleiben weiterhin anpassbar.
- Bestehende V10-Einstellungen werden automatisch übernommen.
- Ausgeblendete V10-Widgets bleiben in V11 entfernt.

### Neue funktionale Widgets

- Schnellbestand:
  - Filament auswählen
  - eine Rolle direkt einlagern
  - eine Rolle direkt auslagern
  - schreibt weiterhin persönliche Protokolleinträge
- Filamentsuche:
  - Suche nach Farbe, Material, Hersteller, Barcode, ID und Lagerplatz
  - direkter Sprung zur Filament-Detailseite
- Tagesbilanz:
  - heutige Einlagerungen
  - heutige Auslagerungen
  - Nettoveränderung
- Lagerplätze:
  - Rollen je Lagerplatz
  - Anzahl der Filamenttypen
  - kritische Bestände je Lagerplatz

Keine Supabase-Änderungen erforderlich.
