# Philamentix Hub V17.2.6 – Wartungs-Control-Center

## 1. Patch einspielen

Den Inhalt des ZIP direkt nach

`C:\Projekte\printos-filamentlager`

entpacken und vorhandene Dateien ersetzen.

## 2. Supabase-Migration

Im Supabase Dashboard den SQL Editor öffnen und

`supabase/maintenance_control_v17_2_6.sql`

vollständig ausführen.

Die Migration erstellt `public.maintenance_rules`, RLS-Regeln und aktiviert Realtime für Wartungsänderungen.

## 3. Bedienung

Unter `/admin` gibt es einen separaten Bereich **Maintenance Control**.

Ziele:
- **Alle Accounts** = globale Regeln.
- **Ausgewählter Account** = Regeln nur für den links ausgewählten Account.

Pro Bereich gibt es:
- **Erben** = keine eigene Regel; die nächsthöhere Regel gilt.
- **Offen** = Bereich ausdrücklich freigeben.
- **Wartung** = Bereich sperren.

Account-Regeln haben Vorrang vor globalen Regeln. Dadurch kann ein einzelner Nutzer z. B. von einer globalen Wartung ausgenommen werden.

Bulk-Aktionen:
- **Gesamten Hub · Wartung**
- **Gesamten Hub · Offen**
- **Overrides entfernen**

Adminaccounts besitzen immer einen Wartungs-Bypass, damit das Adminpanel erreichbar bleibt.

## 4. Aktualisierung bei Nutzern

Wartungsänderungen werden per Supabase Realtime aktualisiert. Zusätzlich lädt der Hub die Regeln alle 30 Sekunden und beim Zurückkehren in den Browser-Tab neu.

## 5. Build

```powershell
npm.cmd run build
```

Danach:

```powershell
git add .
git commit -m "Add maintenance control center"
git push
```
