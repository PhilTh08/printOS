# Code-Check V16.1

## Neue Funktionen

- Konto dauerhaft löschen
- serverseitige JWT-Prüfung vor der Kontolöschung
- E-Mail-Adresse und „KONTO LÖSCHEN“ als Sicherheitsbestätigung
- Passwort bei Login, Reset und Passwortänderung anzeigen/ausblenden
- vollständiges Backup als CSV
- Wiederherstellung aus CSV
- Aufträge im vollständigen Backup
- separater Auftrags-CSV-Export

## CSV-Sicherheit und Robustheit

- UTF-8 mit BOM
- Anführungszeichen, Kommas und Zeilenumbrüche werden erhalten
- Spreadsheet-Formelfelder mit `=`, `+`, `-` oder `@` werden beim Export
  geschützt und beim Import korrekt zurückgewandelt
- Backup-Version und Umfang werden vor dem Löschen vorhandener Daten geprüft
- vollständige und reine Auftrags-Backups werden unterschieden
- Roundtrip-Test mit Komma, Anführungszeichen, Zeilenumbruch und Formelpräfix
  erfolgreich

## Kontolöschung

- Secret Key wird ausschließlich in der Node-Serverroute verwendet
- Access Token wird serverseitig über Supabase Auth validiert
- die Route löscht ausschließlich den Nutzer aus dem validierten Token
- keine Benutzer-ID wird aus dem Browser übernommen
- die vorhandenen `on delete cascade`-Verknüpfungen entfernen die
  nutzerbezogenen Daten

## Erfolgreich geprüft

- 35 TypeScript-/TSX-Dateien auf Parserfehler
- 13 CSS-Dateien mit PostCSS
- 1 JavaScript-Dateien mit `node --check`
- 7 SQL-Dateien auf Transaktionsstruktur
- alle relativen und `@/`-Projektimporte
- keine nackten globalen Selektoren in CSS-Modulen
- CSV-Roundtrip-Test
- doppelte `authReady`-Eigenschaft im Provider entfernt

## Keine neue Migration

V16.1 benötigt keine neue SQL-Datei. `supabase/orders.sql` aus V16 muss
bereits ausgeführt worden sein.

## Abschließender Build

Im vollständigen Projekt:

`npm.cmd run build`


## Nachprüfung

- `StockMode` und `LogSource` im CSV-Parser explizit typisiert
- erfolgreiche Kontolöschung wird nicht durch einen nachfolgenden
  lokalen Sign-out-Fehler blockiert
- kein pauschales Löschen des gesamten Browser-LocalStorage

## Semantischer TypeScript-Check

- lokaler strikter TypeScript-Check mit Modul-Stubs erfolgreich
- neue CSV-, Profil-, Login-, Settings- und API-Dateien ohne Typfehler
