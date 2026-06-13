# ATEAM – Admin-Dashboard · Stand 14.06.2026

Interner Mitarbeiter-Bereich der Alps Agency. Astro (SSR) + Supabase.

> ⚠️ **Achtung:** Diese Datei enthält ein Test-Passwort. Vor dem Veröffentlichen
> in einem öffentlichen Repository entfernen und das Passwort ändern.

## Login
- URL (lokal): `http://localhost:4321/admin/login` (Port kann variieren: 4322/4323, wenn schon belegt)
- **Benutzer:** `admin@alpsagency.de`
- **Passwort:** `ALPS-ateam-2026` *(Start-Passwort – bitte später ändern)*
- Rolle: Admin

## Was funktioniert (V1.1)
| Bereich | Pfad | Status |
|---|---|---|
| **Anfragen** (Leads) | `/admin/` | ✅ echte Daten, Status/Zuweisung/Notizen speichern, Filter |
| **Kunden & Projekte** | `/admin/kunden` | ✅ Tabellen, KPIs, Anlegen + Bearbeiten (Drawer), Fortschritt |
| **Website-Inhalte (CMS)** | `/admin/cms` | ✅ 4 Sprachen (de/en/th/hr), speichert in Supabase* |
| **Statistiken** | `/admin/statistiken` | ✅ KPIs + animierte Charts aus echten Daten |

- Öffentliches **Kontaktformular** speichert neue Anfragen direkt in Supabase → erscheinen unter „Anfragen".
- Modernes Design: Aurora-Hintergrund, Glas-Optik, Count-up-Zahlen, gestaffelte Animationen, respektiert `prefers-reduced-motion`.

## Technik
- **Supabase-Projekt:** `bymnbztudvcjmvbchzvi` (`https://bymnbztudvcjmvbchzvi.supabase.co`)
- Zugang in `.env` (NICHT im Repo – via `.gitignore`). Vorlage: `.env.example`.
- Astro `output: 'static'` + Vercel-Adapter; nur Admin-Seiten sind SSR (`prerender = false`).
- Gemeinsames Layout: `src/layouts/AdminLayout.astro` (Sidebar, Aurora, Design-System).
- Auth-Helfer: `src/lib/supabase.ts`, API-Helfer: `src/lib/adminApi.ts`.

### Datenbank-Tabellen
- `leads` – Anfragen (status: neu/offen/erledigt)
- `customers` – Kunden (status: interessent/aktiv/pausiert/abgeschlossen)
- `projects` – Projekte (status: geplant/in_arbeit/review/live/pausiert, FK → customers)
- `site_content` – CMS-Textblöcke (section/key/lang)
- `profiles` – Mitarbeiter-Rollen (admin/member)

### API-Endpunkte
- `POST /api/contact` – Anfrage anlegen (öffentlich)
- `PATCH /api/leads/:id` – Anfrage bearbeiten
- `POST /api/customers`, `PATCH /api/customers/:id`
- `POST /api/projects`, `PATCH /api/projects/:id`
- `POST /api/cms` – Textblöcke speichern (Upsert)

## Offene nächste Schritte
1. **CMS → Live-Seite verdrahten**: Texte aus `site_content` werden gespeichert, aber die öffentliche Website liest sie noch nicht (zieht aktuell aus den JSON-Sprachdateien).
2. **2FA** (Supabase MFA) – Enrollment-Seite fehlt noch.
3. **Benachrichtigungen**: E-Mail (Resend) + WhatsApp-Bot bei neuer Anfrage.
4. **Deploy** auf Vercel, sobald Domain/Konto stehen (gleiche `.env`-Variablen dort eintragen).

## Lokal starten
```
npm run dev
```
Dann `/admin/login` im Browser öffnen und mit den Zugangsdaten oben anmelden.
