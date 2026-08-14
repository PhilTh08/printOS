Philamentix Hub V18.0 BETA – Produktionszentrum
================================================

NEU
- Beta-gated Produktionszentrum unter /produktion
- Kanban-Board: Warteschlange, Vorbereitung, Druckt, Fertig
- Produktionsjobs anlegen und bearbeiten
- Aufträge verknüpfen
- Druckdateien aus der Druckbibliothek verknüpfen
- Filamente inkl. Materialcheck verknüpfen
- Drucker verwalten und Jobs zuweisen
- Prioritäten: Niedrig, Normal, Hoch, Dringend
- Materialbedarf, Stückzahl, Druckzeit und Fortschritt
- Fehler/Abbruch-Archiv
- Realtime-Sync für Jobs und Drucker
- Produktionszentrum ist im Wartungs-Control-Center separat steuerbar

BETA-GATE
Das Modul benötigt mindestens Release 18.0.
Normale PROD-Nutzer unter 18.0 sehen den Sidebar-Eintrag nicht.
Direkter Aufruf von /produktion zeigt ohne Release-Zugriff nur die Beta-Sperrseite.

EINRICHTUNG
1. Dieses ZIP direkt nach
   C:\Projekte\printos-filamentlager
   entpacken und vorhandene Dateien ersetzen.

2. Im Supabase SQL Editor einmal vollständig ausführen:
   supabase/production_v18_0.sql

3. V18.0-BETA-DEPLOYEN.bat doppelklicken.
   Das Script prüft den Build, committed und pusht bei Erfolg.

4. Nach dem Vercel-Deploy im Adminbereich:
   Release -> Beta
   Kanal: BETA
   Version: 18.0
   Beta-Release aktivieren
   Speichern

5. Unter Admin -> Benutzer den Testaccount mit "Beta freischalten" markieren.
   Der Account bekommt anschließend BETA // 18.0 und sieht "Produktion".

WICHTIG
"Druck starten" ist in Beta 18.0 zunächst ein manueller Produktionsstatus.
Eine echte Bambu-Lab-Anbindung ist noch nicht Bestandteil dieser Beta.
