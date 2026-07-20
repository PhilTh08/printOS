# Auftragssystem einrichten – V16

## 1. Datenbank anlegen

In Supabase:

1. SQL Editor öffnen
2. Neue Query anlegen
3. Den kompletten Inhalt aus `supabase/orders.sql` einfügen
4. Auf **Run** klicken

Die erwartete Meldung lautet:

`Success. No rows returned`

## 2. Update installieren

Das ZIP in das bestehende Projekt entpacken und vorhandene Dateien ersetzen.

Danach:

```powershell
npm.cmd run build
```

Bei erfolgreichem Build:

```powershell
git add .
git commit -m "Minimales Auftragssystem ergänzt"
git push
```

## Enthaltene Funktionen

- Auftrag anlegen
- Auftrag bearbeiten
- Kunde oder Projekt hinterlegen
- Fälligkeitsdatum
- Notizen
- Status: Offen, In Arbeit, Erledigt, Storniert
- Status direkt in der Liste ändern
- Suche und Statusfilter
- Überfällige Aufträge erkennen
- Auftrag löschen
- strikte Trennung nach `user_id` und RLS
- bestehender Adminbereich zeigt die Aufträge automatisch an

## Bewusst noch nicht enthalten

- Zuordnung von Filamenten
- geplanter oder verbrauchter Materialbedarf in Gramm
- automatische Bestandsabbuchung
- Druckdateien
- Rechnungen
- Bambu-Automation
- Auftrags-Export und -Import

Diese Punkte können nacheinander ergänzt werden, ohne die Grundstruktur neu
bauen zu müssen.
