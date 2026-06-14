// Supabase-Clients für das ATEAM-Admin-Dashboard.
// - createSupabaseServer(): SSR-Client, liest die Auth-Cookies aus dem Request-Header
//   und schreibt sie über Astro.cookies zurück. Damit bleibt die Session serverseitig
//   verfügbar (Login-Guard, Leads laden).
import { createServerClient, parseCookieHeader, type CookieOptions } from '@supabase/ssr';
import type { AstroCookies } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Früh & deutlich scheitern, statt mit kryptischen Fehlern weiterzulaufen.
  throw new Error(
    'Supabase-Env fehlt: PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY in .env setzen.'
  );
}

/**
 * Server-Client an die aktuelle Astro-Anfrage gebunden.
 * Übergib `Astro.cookies` (zum Setzen) und `Astro.request` (zum Lesen).
 */
export function createSupabaseServer(cookies: AstroCookies, request: Request) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get('Cookie') ?? '').map(
          ({ name, value }) => ({ name, value: value ?? '' })
        );
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options as CookieOptions);
        });
      },
    },
  });
}

/**
 * Guard für alle geschützten Admin-Seiten. Prüft Login UND 2FA-Stufe (AAL):
 *  - nicht eingeloggt        → /admin/login
 *  - eingeloggt, KEIN Faktor → /admin/2fa-setup (2FA-Pflicht beim ersten Mal)
 *  - eingeloggt, Faktor da   → /admin/2fa (Code abfragen), bis aal2 erreicht ist
 *  - voll verifiziert (aal2) → { redirect: null, … } inkl. Profil-Infos
 *
 * Verwendung in der Seite:
 *   const { supabase, displayName, roleLabel, redirect } = await requireAdmin(Astro.cookies, Astro.request);
 *   if (redirect) return Astro.redirect(redirect);
 */
export async function requireAdmin(cookies: AstroCookies, request: Request) {
  const supabase = createSupabaseServer(cookies, request);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null, displayName: '', roleLabel: '', redirect: '/admin/login' };
  }

  // Temporärer Schalter: ENFORCE_2FA=false in .env hebt den 2FA-Zwang auf
  // (z. B. zum Anpassen des Dashboards). Standard = an.
  const enforce2fa = import.meta.env.ENFORCE_2FA !== 'false';

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (enforce2fa && aal?.currentLevel !== 'aal2') {
    // nextLevel === 'aal2' bedeutet: es existiert bereits ein verifizierter Faktor → nur Code abfragen.
    // andernfalls: noch gar kein Faktor → Einrichtung erzwingen.
    const target = aal?.nextLevel === 'aal2' ? '/admin/2fa' : '/admin/2fa-setup';
    return { supabase, user, displayName: '', roleLabel: '', redirect: target };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single();
  const displayName = profile?.full_name || user.email?.split('@')[0] || 'Team';
  const roleLabel = profile?.role === 'admin' ? 'Admin' : 'Mitarbeiter';

  return { supabase, user, displayName, roleLabel, redirect: null };
}
