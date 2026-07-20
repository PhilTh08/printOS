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


## Ergänzungen in V12 – Widget-Cloud-Synchronisierung

Die Widget-Auswahl, Reihenfolge und Breite werden jetzt pro Benutzer
in Supabase gespeichert. Dadurch ist dasselbe Dashboard auf Desktop,
iPhone und weiteren Geräten verfügbar.

### Vor dem Deployment einmal ausführen

Öffne in Supabase den SQL Editor und führe diese Datei vollständig aus:

`supabase/dashboard_widget_sync.sql`

Die neue Tabelle heißt:

`dashboard_preferences`

Sie besitzt Row Level Security. Jeder Benutzer kann ausschließlich
seine eigene Dashboard-Konfiguration lesen und ändern.

### Verhalten beim ersten Start

- Eine bestehende lokale V11-Widget-Anordnung wird automatisch übernommen.
- Existiert bereits eine Cloud-Konfiguration, wird diese geladen.
- Nach jeder Änderung wird nach kurzer Verzögerung automatisch gespeichert.
- Im Dashboard zeigt ein Badge den Zustand:
  - Cloud-Sync aktiv
  - Cloud wird gespeichert
  - Nur lokal
  - Sync-Fehler
- Im Bearbeitungsmodus gibt es zusätzlich „Cloud neu laden“.
- Fehlt die Tabelle noch, funktioniert das Dashboard weiterhin lokal.

Es sind keine Änderungen an den Tabellen `filaments` oder
`filament_logs` erforderlich.


## Ergänzungen in V13 – Filamentbilder

Filamente können jetzt ein eigenes Produktbild besitzen.

### Einmal in Supabase ausführen

`supabase/filament_images.sql`

Die Migration ergänzt ausschließlich die Spalte:

`filaments.image_url`

Bestehende Filamente bleiben unverändert und erhalten zunächst kein Bild.

### Funktionen

- direkte Bild-URL eintragen
- Bildvorschau beim Erstellen und Bearbeiten
- Bild automatisch aus einem Shopify- oder Produktlink übernehmen
- spezieller Button „Bambu PLA Basic verwenden“
- der Button verwendet diese offizielle Produktseite:
  `https://eu.store.bambulab.com/de/products/pla-basic-filament`
- Produktbild wird in der Filamentübersicht angezeigt
- Produktbild wird auf der Filament-Detailseite angezeigt
- alte Backups ohne Bild bleiben importierbar
- neue Backups enthalten die Bild-URL automatisch

Die Bildübernahme versucht zuerst den Shopify-Produktendpunkt und
anschließend Open-Graph-/Twitter-Metadaten der Produktseite. Falls eine
Seite das automatische Auslesen blockiert, kann die direkte Bild-URL
weiterhin manuell eingetragen werden.


## Ergänzungen in V14 – Produktbild-Auswahl

V13 hat auf Produktseiten mit vielen Varianten teilweise eine
Farbvorschau oder ein Variantenbild als erstes Bild übernommen.

V14 behebt das:

- mehrere Bilder aus Shopify, Open Graph, JSON-LD und der Produktseite
- Farb-Swatches, Icons und Logos werden deutlich schlechter bewertet
- bis zu zwölf passende Produktbilder werden angeboten
- Bildauswahl direkt im Filamentformular
- deutlich sichtbare Markierung des ausgewählten Bildes
- vorhandenes Bild kann entfernt werden
- Bambu PLA Basic öffnet jetzt eine Bilderauswahl statt blind das erste Bild zu verwenden

### Nach dem Update

Bei einem Filament mit dem falschen Bild:

1. „Details & Bearbeiten“ öffnen
2. „Produktbilder laden“ drücken
3. das richtige Produktfoto anklicken
4. Änderungen speichern

Für V14 ist keine neue Supabase-Migration erforderlich.
Die V13-Spalte `image_url` wird weiterverwendet.


## V14.1 – TypeScript-Buildfix

Behoben wurde der Vercel-Fehler:

`app/api/product-image/route.ts: image is possibly null or undefined`

Die Bilddaten werden jetzt vor dem Zugriff ausdrücklich auf `null`
und `undefined` geprüft.

Keine neue Supabase-Migration erforderlich.


## V14.2 – Produktbilder vollständig anzeigen

Behoben:

- Filamentkarten verwendeten einen festen, zu flachen Bildbereich.
- Kartenbilder verwenden jetzt ein responsives Seitenverhältnis.
- Bilder werden mit `object-fit: contain` vollständig dargestellt.
- Die Bildposition ist immer mittig.
- Shopify-Parameter wie `crop`, `width`, `height` und `fit` werden aus
  automatisch übernommenen Bild-URLs entfernt.
- Alte Shopify-Größensuffixe im Dateinamen werden ebenfalls entfernt.

Bereits gespeicherte, zugeschnittene URLs sollten einmal neu geladen werden:

1. Filament öffnen
2. „Produktbilder laden“
3. gewünschtes Bild auswählen
4. speichern

Keine neue Supabase-Migration erforderlich.


## V14.3 – Bestandsstatus an Filamentkarten

Der farbige Streifen der Filamentkarten arbeitet jetzt als Ampel:

- Rot: Bestand ist 0
- Orange: Bestand ist größer als 0, aber am oder unter dem Mindestbestand
- Grün: Bestand liegt über dem Mindestbestand

Die Grenze verwendet den bereits pro Filament gespeicherten Mindestbestand.
Es ist keine neue Supabase-Migration erforderlich.

Zusätzlich liegt dem Paket `CODE-CHECK-V14.3.md` mit den ausgeführten
Prüfungen und deren Grenzen bei.


## V14.4 – Bilddarstellung in den Einstellungen

Unter `Einstellungen → Filamentbilder anzeigen` stehen jetzt drei Modi
zur Auswahl:

- Aus:
  - keine Bilder in der Filamentübersicht
  - keine Bilder in der Filament-Detailansicht
  - besonders kompakte Karten
- Klein:
  - flache, kompakte Vorschaubilder
  - mehr Platz für Bestandsinformationen
- Groß:
  - bisherige große Produktdarstellung

Die Bildvorschau im Bearbeitungsformular bleibt in allen Modi sichtbar,
damit ein Bild weiterhin ausgewählt, geändert oder entfernt werden kann.

### Einmal in Supabase ausführen

`supabase/user_preferences.sql`

Die Einstellung wird pro Benutzer gespeichert und zwischen Geräten
synchronisiert. Ohne ausgeführte SQL-Datei funktioniert die Option
weiterhin lokal in dem jeweiligen Browser.

Die Filament- und Protokolldatenbanken werden durch die Migration nicht
verändert.


## V14.5 – Standardwerte für neue Filamente

Unter `Einstellungen → Neue Filamente → Standardwerte` können jetzt
persönlich gespeichert werden:

- Hersteller
- Material
- Gewicht pro Rolle
- Lagerplatz
- Mindestbestand

Die Werte werden automatisch verwendet bei:

- `Filamente → Filament hinzufügen`
- dem Anlegen nach einem unbekannten Barcode-Scan

Barcode, Farbe, aktueller Bestand, Bestelllink und Bild bleiben weiterhin
individuell pro neuem Filament.

Bestehende Filamente werden durch eine Änderung der Standardwerte niemals
verändert.

### Supabase erneut aktualisieren

Die vorhandene Datei wurde erweitert und muss einmal erneut vollständig
ausgeführt werden:

`supabase/user_preferences.sql`

Sie ergänzt ausschließlich neue Spalten in `user_preferences`. Die Datei
ist erneut ausführbar und behält die persönliche RLS-Isolation bei.

Ohne die aktualisierte Migration funktionieren die Standardwerte weiterhin
lokal im jeweiligen Browser.


## V15 – Admin- und Supportsystem

Der Adminzugriff wird ausschließlich über die Supabase-Tabelle
`public.user_roles` vergeben. Ein normaler Benutzer kann seine Rolle
nicht selbst ändern.

### Enthalten

- Adminnavigation nur für eingetragene Administratoren
- Nutzerliste aus Supabase Auth
- Konten sperren und entsperren
- Filamente eines Nutzers ansehen und korrigieren
- Protokolle eines Nutzers ansehen
- fehlerhafte Protokolleinträge mit Supportgrund entfernen
- vorbereitete Auftragsansicht
- vollständiges Admin-Aktionsprotokoll mit:
  - Administrator
  - Zielbenutzer
  - Aktion
  - Supportgrund
  - Vorher-/Nachher-Daten
  - Erfolg oder Fehler
  - Zeitstempel
- Schutz gegen das Sperren des eigenen Adminaccounts
- Adminaccounts können erst gesperrt werden, nachdem ihre Adminrolle in
  Supabase entfernt wurde

### 1. Supabase-Migration

Einmal vollständig ausführen:

`supabase/admin_system.sql`

### 2. Deinen Account zum Admin machen

Im Supabase SQL Editor die E-Mail ersetzen und separat ausführen:

```sql
insert into public.user_roles (
  user_id,
  role
)
select
  id,
  'admin'
from auth.users
where lower(email) = lower('DEINE-EMAIL@BEISPIEL.DE')
on conflict (user_id)
do update set role = excluded.role;
```

Anschließend die App neu laden. Ein erneutes Login ist für die Anzeige der
Navigation normalerweise nicht erforderlich, weil die Rolle direkt aus
`user_roles` gelesen wird.

### 3. Geheime Servervariable in Vercel

In Vercel unter `Project → Settings → Environment Variables` eine der
folgenden Variablen anlegen:

Empfohlen:

`SUPABASE_SECRET_KEY`

Alternativ mit dem bisherigen Schlüssel:

`SUPABASE_SERVICE_ROLE_KEY`

Als Wert den Secret-Key aus Supabase verwenden. Der Variablenname darf
**niemals** mit `NEXT_PUBLIC_` beginnen. Der Schlüssel wird ausschließlich
in Next.js-Serverrouten verwendet und darf nicht in GitHub eingecheckt
werden.

Nach dem Hinzufügen der Variable ein neues Vercel-Deployment starten.

### 4. Aufträge

Das eigentliche Auftragssystem existiert noch nicht. Der Adminbereich prüft
bereits sicher auf eine spätere Tabelle `orders`. Solange sie nicht
vorhanden ist, erscheint eine verständliche Vorbereitungsmeldung statt
 eines Fehlers.

### Hinweis zur Kontosperre

Die Sperre wird über Supabase Auth `ban_duration` gesetzt. Neue Logins und
Token-Erneuerungen werden dadurch blockiert. Ein bereits ausgestelltes
kurzlebiges Access-Token kann technisch noch bis zu seinem Ablauf gültig
sein; deshalb sollte die JWT-Laufzeit in Supabase nicht unnötig lang sein.


## V15.1 – Online-Status im Adminbereich

Der Adminbereich zeigt jetzt:

- Anzahl der aktuell aktiven Nutzer
- grünen pulsierenden Punkt bei Online-Nutzern
- grauen Punkt bei Offline-Nutzern
- Zeitpunkt der letzten Aktivität
- Online-/Offline-Badge beim ausgewählten Account
- automatische Aktualisierung alle 20 Sekunden

Ein Benutzer gilt als online, wenn innerhalb der letzten 75 Sekunden ein
serverseitiger Heartbeat eingegangen ist. Der angemeldete Browser sendet
alle 30 Sekunden einen Heartbeat.

### Bestehende V15-Installation

Einmal diese neue Datei im Supabase SQL Editor ausführen:

`supabase/admin_online_presence.sql`

Die bereits vergebene Adminrolle und vorhandenen Adminprotokolle bleiben
unverändert.

### Sicherheit

- der Nutzer übermittelt keine frei wählbare Benutzer-ID
- `auth.uid()` wird serverseitig verwendet
- der Zeitstempel entsteht mit PostgreSQL `now()`
- RLS erlaubt einem Nutzer nur seinen eigenen Presence-Datensatz
- die vollständige Nutzerübersicht bleibt in der geschützten Admin-API
- es werden keine Seitenpfade oder Browserdaten erfasst

Bei einem abrupt geschlossenen Browser kann der Account noch maximal rund
75 Sekunden als online erscheinen. Das ist bei Heartbeat-Systemen normal.


## V15.2 – Größere Schrift im gesamten Panel

Die Lesbarkeit wurde appweit angehoben:

- 16 px Grundschrift
- Navigation überwiegend 15 px
- Tabellen und Listen mindestens 13–14 px
- größere Überschriften und Kennzahlen
- Eingaben und Buttons mindestens 46 px hoch
- breitere Desktop-Sidebar
- mehr Innenabstand in Karten und Panels
- größere mobile Bedienelemente
- bestehender Industrial-Look, Farben und Funktionen bleiben erhalten

Im Paket liegt außerdem:

`DESIGNVORSCHLAG-V15.2.html`

Die Datei kann direkt im Browser geöffnet werden und zeigt einen
alternativen, lesbareren Entwurf für Dashboard und Adminbereich.

Keine neue Supabase-Migration erforderlich.


## V15.2.1 – CSS-Module-Buildfix

Der V15.2-Buildfehler mit der Meldung

`Selector "button" is not pure`

wurde behoben. Globale Elementselektoren wurden aus sämtlichen
`*.module.css`-Dateien entfernt. Die größeren Schrift- und
Bedienelementregeln bleiben gültig in `app/globals.css`.

Keine neue Supabase-Migration erforderlich.


## V15.2.2 – abgeschnittener Sidebar-Schriftzug

Der Schriftzug `PhilamentixHub` passt sich jetzt an die verfügbare
Sidebarbreite an. Besonders beim 1120-px-Breakpoint wird die Schriftgröße
reduziert, damit `Hub` nicht mehr am rechten Rand abgeschnitten wird.

Es wurden keine Funktionen, Farben oder weiteren Layoutbereiche verändert.
Keine neue Supabase-Migration erforderlich.


## V16 – Minimales Auftragssystem

Neue Route:

`/auftraege`

Vor der ersten Nutzung einmal ausführen:

`supabase/orders.sql`

Enthalten sind Anlegen, Bearbeiten, Statuspflege, Suche, Termin,
Überfälligkeitsanzeige und Löschen. Jeder Nutzer sieht durch RLS nur seine
eigenen Aufträge. Der vorhandene Adminbereich liest die neue Tabelle
automatisch mit.

Noch nicht enthalten sind Filamentzuordnung, Grammverbrauch, automatische
Bestandsabbuchung, Rechnungen und Drucker-Automation.


## V16.1 – Kontolöschung, Passwortanzeige und CSV

Neu:

- eigenes Konto unter Profil & Sicherheit dauerhaft löschen
- E-Mail-Adresse und „KONTO LÖSCHEN“ als Sicherheitsbestätigung
- Passwort beim Login, Reset und Ändern anzeigen/ausblenden
- Backup und Wiederherstellung vollständig als CSV
- Aufträge sind im Gesamtbackup enthalten
- separater Auftrags-CSV-Export auf `/auftraege`

Keine neue SQL-Migration erforderlich. Die Servervariable
`SUPABASE_SECRET_KEY` aus dem Adminsystem wird auch für die Kontolöschung
verwendet.
