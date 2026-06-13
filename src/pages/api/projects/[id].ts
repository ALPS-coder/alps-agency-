// PATCH /api/projects/:id — Projekt aktualisieren.
import type { APIRoute } from 'astro';
import { json, requireUser, str } from '../../../lib/adminApi';

export const prerender = false;

const STATUS = new Set(['geplant', 'in_arbeit', 'review', 'live', 'pausiert']);
const PKG = new Set(['starter', 'business', 'premium']);

function num(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
}

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const { supabase, user } = await requireUser(cookies, request);
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  const b = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};
  if ('title' in b) { const t = str(b.title); if (!t) return json({ error: 'Titel darf nicht leer sein.' }, 422); update.title = t; }
  if ('customer_id' in b) update.customer_id = str(b.customer_id) || null;
  if ('package' in b) update.package = PKG.has(str(b.package)) ? str(b.package) : null;
  if ('status' in b) { if (!STATUS.has(str(b.status))) return json({ error: 'Ungültiger Status.' }, 422); update.status = str(b.status); }
  if ('progress' in b) update.progress = Math.min(100, Math.max(0, Math.round(num(b.progress) ?? 0)));
  if ('price' in b) update.price = num(b.price);
  if ('deadline' in b) update.deadline = str(b.deadline) || null;
  if ('notes' in b) update.notes = str(b.notes) || null;
  if (Object.keys(update).length === 0) return json({ error: 'Keine Änderungen.' }, 422);

  const { data, error } = await supabase.from('projects').update(update).eq('id', params.id).select().single();
  if (error) { console.error('[api/projects] update:', error.message); return json({ error: 'Speichern fehlgeschlagen.' }, 500); }
  return json({ ok: true, project: data });
};
