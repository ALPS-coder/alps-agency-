// POST /api/contact — speichert eine neue Anfrage aus dem öffentlichen Kontaktformular
// in Supabase (Tabelle public.leads). RLS erlaubt anon-INSERT.
import type { APIRoute } from 'astro';
import { createSupabaseServer } from '../../lib/supabase';

export const prerender = false;

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request, cookies }) => {
  let data: Record<string, unknown>;
  try {
    data = await request.json();
  } catch {
    return json({ error: 'Ungültige Anfrage.' }, 400);
  }

  // Honeypot: Bots füllen das versteckte „company"-Feld → still als Erfolg quittieren.
  if (typeof data.company === 'string' && data.company.trim() !== '') {
    return json({ ok: true });
  }

  const name = str(data.name);
  const email = str(data.email);
  const message = str(data.message);

  if (!name || !email || !message) {
    return json({ error: 'Bitte Name, E-Mail und Nachricht ausfüllen.' }, 422);
  }
  if (!emailRe.test(email)) {
    return json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' }, 422);
  }

  const supabase = createSupabaseServer(cookies, request);
  const { error } = await supabase.from('leads').insert({
    name,
    email,
    message,
    phone: str(data.phone) || null,
    industry: str(data.industry) || null,
    source: str(data.source) || null,
    lang: str(data.lang) || 'de',
  });

  if (error) {
    console.error('[api/contact] Insert fehlgeschlagen:', error.message);
    return json({ error: 'Konnte die Anfrage nicht speichern. Bitte später erneut versuchen.' }, 500);
  }

  // TODO: E-Mail-Benachrichtigung (Resend) + WhatsApp-Bot — folgt in einem späteren Schritt.
  return json({ ok: true });
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
