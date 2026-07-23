# Code-Check V17.2

## Durchgeführte Prüfungen

- 39 TypeScript-/TSX-Dateien ohne Parserfehler
- strenge Typprüfung der geänderten V17.2-Dateien mit lokalen Schnittstellen-Stubs
- alle verwendeten CSS-Module-Klassen sind definiert
- keine verdoppelten Konstantennamen wie `PREVIEW_PREVIEW_*`
- V17.2-Migration ist wiederholbar aufgebaut (`if not exists` / Constraint-Prüfung)
- Viewer-Loader und Controls gegen die offiziellen Three.js-Schnittstellen abgeglichen
- Vorschaurenderung verwendet einen Modellklon und entfernt das Live-Modell nicht aus dem Viewer
- generierte Vorschauen werden bei Uploadfehlern soweit möglich zurückgerollt
- Projektlöschung funktioniert auch vor Ausführung der V17.2-Migration weiter

## Noch lokal auszuführen

Da das Übergabepaket keine `node_modules` und keine geheimen Umgebungsvariablen enthält, muss im echten Projektordner abschließend ausgeführt werden:

```powershell
V17-2-INSTALLIEREN.bat
npm.cmd run build
```

Ein erfolgreicher Next.js-Build im echten Repository bleibt die abschließende Freigabeprüfung.
