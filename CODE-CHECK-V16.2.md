# Code-Check V16.2

## Demo-Modus

- Auswahlseite vor dem Anmeldefenster
- eigenständige Route `/demo`
- keine Supabase-Schreib- oder Lesezugriffe in der Demo
- lokale Filamentbuchungen mit Schutz vor negativem Bestand
- lokale Auftragsstatuswechsel
- Aktivitätsprotokoll pro Demositzung
- Reset auf definierte Beispieldaten
- responsive Desktop-, Tablet- und Mobilansicht
- direkter Rückweg zur Anmeldung

## Sicherheit

Der Demo-Modus verwendet keine Authentifizierung und keine Datenbank. Die
Beispieldaten existieren ausschließlich im React-Zustand der geöffneten Seite
und werden beim Neuladen beziehungsweise Zurücksetzen verworfen.

## Installation

Keine neue SQL-Migration und keine zusätzliche Vercel-Variable.
