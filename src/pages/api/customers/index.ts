// POST /api/customers — neuen Kunden anlegen.
import type { APIRoute } from 'astro';
import { json, requireUser, str } from '../../../lib/adminApi';

export const prerender = false;

const STATUS = new Set(['interessent', 'aktiv', 'pausiert', 'abgeschlossen']);

export const POST: APIRoute = async ({ request, cookies }) => {
  const { supabase, user } = await requireUser(cookies, request);
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  const b = await request.json().catch(() => ({}));
  const name = str(b.name);
  if (!name) return json({ error: 'Name ist erforderlich.' }, 422);
  const status = STATUS.has(str(b.status)) ? str(b.status) : 'interessent';

  const { data, error } = await supabase.from('customers').insert({
    name, status,
    company: str(b.company) || null,
    email: str(b.email) || null,
    phone: str(b.phone) || null,
    industry: str(b.industry) || null,
    notes: str(b.notes) || null,
  }).select().single();

  if (error) { console.error('[api/customers] insert:', error.message); return json({ error: 'Speichern fehlgeschlagen.' }, 500); }
  return json({ ok: true, customer: data });
};
