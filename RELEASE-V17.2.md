# Philamentix Hub V17.2 – Release

## Fertiggestellt

- Three.js-basierter STL-/3MF-Viewer
- Orbit-Steuerung für Drehen, Zoomen und Verschieben
- Drahtgittermodus und Kamera-Reset
- automatische Modellmaße, Mesh-Volumen und Dreiecksanzahl
- automatische Vorschaurenderung ohne das Live-Modell aus dem Viewer zu entfernen
- Speicherung der Metadaten in Supabase
- generierte PNG-Vorschaubilder im privaten Storage
- automatische Projektcover für hochgeladene Modelle
- Versionsgruppen mit fortlaufenden Versionsnummern
- Upload einer neuen Version direkt an einer Modelldatei
- Unterstützung mehrerer Bild-, Dokument- und Videoformate
- Rückwärtskompatible Anzeige, solange die V17.2-Migration noch fehlt
- verbesserte Bereinigung von Quelldateien und generierten Vorschauen

## Technische Änderungen

Neue Dateien:

- `components/philamentix/model-analyzer.ts`
- `components/philamentix/model-viewer.tsx`
- `components/philamentix/model-viewer.module.css`
- `supabase/print_library_v17_2.sql`

Neue Abhängigkeiten:

- `three@0.185.1`
- `@types/three@0.185.1`

## Sicherheit und Datenschutz

Die Analyse erfolgt im Browser des angemeldeten Benutzers. Dateien werden weiterhin ausschließlich im privaten Supabase-Bucket gespeichert. Die bestehende Benutzertrennung über Pfadprüfung und Row Level Security bleibt erhalten.
