# Philamentix Hub V17.2 – 3D-Viewer und Modellmetadaten

## Installation

1. Erstelle zuerst eine Sicherung deines aktuellen Projektordners.
2. Entpacke dieses ZIP direkt in deinen bestehenden PrintOS-/Philamentix-Ordner und ersetze vorhandene Dateien.
3. Starte im Projektordner:

```powershell
V17-2-INSTALLIEREN.bat
```

Das Skript installiert die benötigten Pakete und führt direkt `npm.cmd run build` aus.

Alternativ manuell:

```powershell
npm.cmd install three@0.185.1
npm.cmd install --save-dev @types/three@0.185.1
```

4. Öffne Supabase → SQL Editor.
5. Führe `supabase/print_library_v17_2.sql` vollständig aus.
6. Falls du den Build später erneut prüfen möchtest:

```powershell
V17-2-PRUEFEN.bat
```

7. Erst nach einem erfolgreichen Build veröffentlichen:

```powershell
git add .
git commit -m "Philamentix Hub V17.2 3D Viewer"
git push
```

## Neue Funktionen

- interaktiver STL- und 3MF-Viewer direkt im Browser
- Modell drehen, zoomen und verschieben
- Drahtgitteransicht und Kamera-Reset
- automatische Ermittlung von Breite, Tiefe und Höhe
- Berechnung von Mesh-Volumen und Dreiecksanzahl
- automatische PNG-Projektvorschau bei kleineren Modellen
- Analyse großer Modelle beim bewussten Öffnen im Viewer
- Dateiversionen V1, V2, V3 und weitere innerhalb einer Versionsgruppe
- neue Versionen behalten ältere Dateien und Metadaten
- mehrere Bilder, PDFs, Texte und Videos pro Projekt
- erzeugte Modellvorschauen können als Projektbild verwendet werden

## Hinweise

- STL-Dateien besitzen keine verbindliche Einheit. Philamentix behandelt STL-Abmessungen wie im 3D-Druck üblich als Millimeter.
- Das Volumen ist bei geschlossenen, fehlerfreien Meshes am zuverlässigsten. Offene oder sich überschneidende Modelle können abweichende Werte liefern.
- Modelle bis 30 MB werden nach dem Upload automatisch analysiert. Größere Dateien werden erst beim Öffnen des Viewers verarbeitet, damit der Browser nicht unnötig blockiert.
- Beim reinen lokalen Ordnerscan werden weiterhin keine Dateiinhalte hochgeladen. Der Upload beginnt erst nach der Importbestätigung.
