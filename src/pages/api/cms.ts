// POST /api/cms — speichert geänderte Website-Textblöcke (Upsert je section/key/lang).
import type { APIRoute } from 'astro';
import { json, requireUser, str } from '../../lib/adminApi';

export const prerender = false;

const LANGS = new Set(['de', 'en', 'th', 'hr']);

export const POST: APIRoute = async ({ request, cookies }) => {
  const { supabase, user } = await requireUser(cookies, request);
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  const b = await request.json().catch(() => ({}));
  const updates = Array.isArray(b.updates) ? b.updates : [];
  if (updates.length === 0) return json({ error: 'Keine Änderungen.' }, 422);

  const rows = updates
    .filter((u: any) => str(u.section) && str(u.key) && LANGS.has(str(u.lang)))
    .map((u: any) => ({ section: str(u.section), key: str(u.key), lang: str(u.lang), value: typeof u.value === 'string' ? u.value : '', updated_at: new Date().toISOString() }));

  if (rows.length === 0) return json({ error: 'Ungültige Daten.' }, 422);

  const { error } = await supabase.from('site_content').upsert(rows, { onConflict: 'section,key,lang' });
  if (error) { console.error('[api/cms] upsert:', error.message); return json({ error: 'Speichern fehlgeschlagen.' }, 500); }
  return json({ ok: true, saved: rows.length });
};
