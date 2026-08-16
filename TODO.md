# Philamentix Hub – TODO

## Später: einheitliches Icon-System
- [ ] komplette Haupt-Sidebar auf einen konsistenten Icon-Satz umstellen
- [ ] Platzhalterzeichen wie `⇈`, `≡`, `◇`, `◆`, `▦`, `▤` ersetzen
- [ ] gleiche Icon-Größe, Strichstärke, Abstände und Hover/Active-Zustände
- [ ] Adminnavigation und mobile Navigation optisch angleichen

## V18.5 – letzter Check vor Release
- [ ] Admin-Leiste: Benutzer · Release · Wartung · System · Release Center · System-Log · Systemstatus
- [ ] Release Center lädt ohne Fehler
- [ ] animierter Release-Center-Status zeigt erwarteten Zustand
- [ ] System-Log lädt und zeigt Aktionen
- [ ] Systemstatus lädt und aktualisiert sich automatisch
- [ ] Supabase / GitHub / Vercel Checks plausibel
- [ ] Vercel Deployments erscheinen im Systemstatus
- [ ] Fehlerzentrale zeigt Warnungen/Störungen verständlich an
- [ ] Haupt-Sidebar zeigt unter Administration nur Admin & Support
- [ ] Mobile/kleinere Breite kurz prüfen

## Noch nötige Vercel-Konfiguration für Live-Deployments
- [ ] `VERCEL_API_TOKEN` als geheime Environment Variable für Production + V18.5 Preview
- [ ] optional `VERCEL_PROJECT_ID` setzen; ohne Wert wird `print-os` verwendet
- [ ] optional `VERCEL_TEAM_ID` setzen, falls der Token ein Team explizit benötigt
