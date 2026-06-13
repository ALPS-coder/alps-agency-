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
