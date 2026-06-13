// PATCH /api/customers/:id — Kunden aktualisieren.
import type { APIRoute } from 'astro';
import { json, requireUser, str } from '../../../lib/adminApi';

export const prerender = false;

const STATUS = new Set(['interessent', 'aktiv', 'pausiert', 'abgeschlossen']);

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const { supabase, user } = await requireUser(cookies, request);
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  const b = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if ('name' in b) { const n = str(b.name); if (!n) return json({ error: 'Name darf nicht leer sein.' }, 422); update.name = n; }
  if ('company' in b) update.company = str(b.company) || null;
  if ('email' in b) update.email = str(b.email) || null;
  if ('phone' in b) update.phone = str(b.phone) || null;
  if ('industry' in b) update.industry = str(b.industry) || null;
  if ('notes' in b) update.notes = str(b.notes) || null;
  if ('status' in b) { if (!STATUS.has(str(b.status))) return json({ error: 'Ungültiger Status.' }, 422); update.status = str(b.status); }
  if (Object.keys(update).length === 0) return json({ error: 'Keine Änderungen.' }, 422);

  const { data, error } = await supabase.from('customers').update(update).eq('id', params.id).select().single();
  if (error) { console.error('[api/customers] update:', error.message); return json({ error: 'Speichern fehlgeschlagen.' }, 500); }
  return json({ ok: true, customer: data });
};
