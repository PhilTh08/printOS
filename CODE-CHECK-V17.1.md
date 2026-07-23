# Code-Check V17.1

## Neue Funktionen

- lokaler rekursiver Ordner-Scan nach bewusster Benutzerauswahl
- konfigurierbare Formatgruppen
- Trefferliste mit Pfad, Dateityp, Größe und Importstatus
- aufklappbare Liste ignorierter Dateien mit Pfad, Endung, Größe und Grund
- Suche und Formatfilter
- Import in ein neues oder vorhandenes Druckprojekt
- relative Pfade und lokale Änderungszeitpunkte werden gespeichert
- unveränderte Dateien werden beim erneuten Import übersprungen
- geänderte Dateien mit identischem Pfad werden ersetzt
- Uploadfortschritt und Rollback bei Fehlern

## Unterstützte Formate

- Modelle: STL, 3MF, OBJ, PLY, AMF
- Druckdateien: G-Code, BG-Code, Chitubox, CTB, GOO
- CAD: STEP, STP, F3D, FCSTD, SCAD, IGES, IGS, DXF
- Referenzen: JPG, JPEG, PNG, WebP, GIF, SVG, BMP, PDF, TXT, MD
- Archive: ZIP

## Sicherheit

- der Browser erhält nur Zugriff auf den vom Benutzer ausgewählten Ordner
- der Scan liest Dateinamen, Pfade, Größen und Änderungszeiten lokal
- Dateiinhalte werden erst beim bestätigten Import hochgeladen
- Storagepfade beginnen weiterhin mit der authentifizierten Benutzer-ID
- RLS und privater Storage-Bucket aus V17.0 bleiben unverändert aktiv
- keine Pfade des lokalen Computers werden als Storagepfade verwendet
- 100 MB pro Datei, 250 Dateien und 1 GB pro Import
- bei Fehlern werden neu hochgeladene Dateien und Metadaten zurückgerollt

## Erfolgreich geprüft

- 37 TypeScript-/TSX-Dateien auf Parserfehler
- 14 CSS-Dateien mit PostCSS
- 1 JavaScript-Dateien mit `node --check`
- 9 SQL-Dateien auf Transaktionsstruktur
- alle lokalen Projektimporte
- keine nackten globalen Selektoren in CSS-Modulen
- Scanner-Unit-Test mit Unterordnern, unbekannten Dateien, Ignorierliste und Größenlimit
- Migration und frische Installations-SQL enthalten die neuen Spalten

## Abschließender Build

Das Paket bleibt ein Update-Overlay. Im vollständigen lokalen Projekt ausführen:

`npm.cmd run build`

## Nachprüfung und Layout

- Scanergebnisse werden mit 200 Einträgen pro Seite gerendert, damit große
  Ordner die Benutzeroberfläche nicht blockieren
- die Reihenfolge beim Ersetzen geänderter Dateien wurde so angepasst, dass
  ein Fehler bei der Altdatei-Bereinigung keinen erfolgreichen Neuimport
  zurückrollt
- doppelte relative Pfade innerhalb derselben Auswahl werden übersprungen
- ignorierte Dateien werden bis 500 Einträge einzeln dargestellt; weitere Treffer werden gezählt
- Scannerlogik, 37 TypeScript-/TSX-Dateien, 14 CSS-Dateien und 9 SQL-Dateien wurden erneut geprüft
