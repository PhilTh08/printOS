# Philamentix V15 – Admin einrichten

1. `supabase/admin_system.sql` im Supabase SQL Editor ausführen.
2. Eigenen Account per E-Mail in `public.user_roles` als `admin` eintragen.
3. In Vercel `SUPABASE_SECRET_KEY` als geheime Servervariable anlegen.
4. Neu deployen.
5. App aktualisieren und links `Admin & Support` öffnen.

Der Secret-Key darf nie in `NEXT_PUBLIC_...`, Browsercode, GitHub oder
Screenshots auftauchen.
