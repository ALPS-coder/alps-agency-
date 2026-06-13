// Gemeinsame Helfer für die Admin-API-Endpunkte.
import type { AstroCookies } from 'astro';
import { createSupabaseServer } from './supabase';

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Liefert den Supabase-Client + sichert ab, dass ein Nutzer angemeldet ist. */
export async function requireUser(cookies: AstroCookies, request: Request) {
  const supabase = createSupabaseServer(cookies, request);
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
