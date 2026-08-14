Philamentix Hub V18.4.2 BETA – Module + Smooth Sync Fix
===========================================================

DIESER PATCH behebt zwei Dinge gleichzeitig:

1) Beta-Module 18.1 / 18.2 / 18.3 / 18.4
   - Der komplette V18.4 Produktions-Code ist in diesem Paket enthalten.
   - Beta-Versionen werden im Adminbereich per Klick SOFORT aktiviert.
   - Downgrades blenden neuere Module nur aus.
   - Produktions-/Drucker-/QS-/Etikettendaten werden NICHT gelöscht.

2) Sichtbares Dauer-Aktualisieren
   - Release- und Wartungszustand lösen nur noch dann React-Updates aus,
     wenn sich die Daten wirklich geändert haben.
   - Realtime bleibt aktiv.
   - Polling ist nur noch ein ruhiger Fallback.
   - Temporäre Netzwerkfehler werfen Beta-Tester nicht mehr kurz auf PROD zurück.

Installation
------------
1. ZIP DIREKT nach
   C:\Projekte\printos-filamentlager
   entpacken und Dateien ersetzen.

2. V18.4.2-BETA-DEPLOYEN.bat doppelklicken.

3. Keine NEUE SQL-Migration erforderlich.
   Die bekannte production_v18_1_to_v18_4.sql liegt zur Sicherheit erneut
   unter supabase/ bei. Nur ausführen, falls sie bei dir noch NICHT lief.

Beta-Version wechseln
---------------------
Admin -> Release -> Beta-Version auswählen.

Ein Klick auf 18.0 / 18.1 / 18.2 / 18.3 / 18.4 aktiviert die Stufe sofort.
Bei Downgrade erscheint eine Sicherheitsabfrage.

Wichtig:
- Beta-Release muss aktiviert sein.
- Der Nutzer muss als Beta-Tester freigeschaltet sein.
- 18.4 -> 18.2 löscht KEINE Daten.
- Wieder auf 18.4 wechseln -> QS-/QR-/Etikettendaten sind wieder da.

Enthaltene Reparaturdateien
---------------------------
components/philamentix/hub-provider.tsx
components/philamentix/hub-shell.tsx
components/philamentix/maintenance.ts
app/(hub)/produktion/page.tsx
app/(hub)/produktion/page.module.css
app/(hub)/admin/page.tsx
app/(hub)/admin/page.module.css
app/api/admin/releases/route.ts
