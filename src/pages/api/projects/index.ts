// POST /api/projects — neues Projekt anlegen.
import type { APIRoute } from 'astro';
import { json, requireUser, str } from '../../../lib/adminApi';

export const prerender = false;

const STATUS = new Set(['geplant', 'in_arbeit', 'review', 'live', 'pausiert']);
const PKG = new Set(['starter', 'business', 'premium']);

function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const { supabase, user } = await requireUser(cookies, request);
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  const b = await request.json().catch(() => ({}));
  const title = str(b.title);
  if (!title) return json({ error: 'Titel ist erforderlich.' }, 422);

  const progress = Math.min(100, Math.max(0, Math.round(num(b.progress) ?? 0)));
  const { data, error } = await supabase.from('projects').insert({
    title, progress,
    customer_id: str(b.customer_id) || null,
    package: PKG.has(str(b.package)) ? str(b.package) : null,
    status: STATUS.has(str(b.status)) ? str(b.status) : 'geplant',
    price: num(b.price),
    deadline: str(b.deadline) || null,
    notes: str(b.notes) || null,
  }).select().single();

  if (error) { console.error('[api/projects] insert:', error.message); return json({ error: 'Speichern fehlgeschlagen.' }, 500); }
  return json({ ok: true, project: data });
};
