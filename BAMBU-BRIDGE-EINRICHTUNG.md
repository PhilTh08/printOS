# Philamentix Bambu-Bridge

Die Bridge ermöglicht das direkte Öffnen von STL- und 3MF-Dateien aus der Druckbibliothek in Bambu Studio.

## Installation

1. Philamentix öffnen.
2. In der Druckbibliothek oben auf **Bambu-Bridge** klicken.
3. Die drei Dateien aus `public/bambu-bridge` zusammen herunterladen bzw. den Ordner aus dem Projekt verwenden.
4. `Philamentix-Bambu-Bridge-installieren.bat` starten.
5. Die Windows-Rückfrage beim ersten Öffnen bestätigen.

Die Installation benötigt keine Administratorrechte. Sie registriert das lokale Protokoll `philamentix-bambu://` nur für den angemeldeten Windows-Benutzer.

## Sicherheit

- Nur HTTPS-Downloads werden akzeptiert.
- Nur `.stl` und `.3mf` werden geöffnet.
- Vor jedem Download zeigt Windows Dateiname und Quelle an.
- Die Datei wird unter `%LOCALAPPDATA%\Philamentix\BambuBridge\Downloads` gespeichert.
