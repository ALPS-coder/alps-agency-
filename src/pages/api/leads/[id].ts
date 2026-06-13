// PATCH /api/leads/:id — aktualisiert Status / Zuweisung / Notizen einer Anfrage.
// Nur für eingeloggte Mitarbeiter (RLS verlangt eine gültige Session).
import type { APIRoute } from 'astro';
import { createSupabaseServer } from '../../../lib/supabase';

export const prerender = false;

const STATUS = new Set(['neu', 'offen', 'erledigt']);

export const PATCH: APIRoute = async ({ params, request, cookies }) => {
  const supabase = createSupabaseServer(cookies, request);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Nicht angemeldet.' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Ungültige Anfrage.' }, 400);
  }

  const update: Record<string, unknown> = {};
  if (typeof body.status === 'string') {
    if (!STATUS.has(body.status)) return json({ error: 'Ungültiger Status.' }, 422);
    update.status = body.status;
  }
  if (typeof body.assignee === 'string') update.assignee = body.assignee || null;
  if (typeof body.notes === 'string') update.notes = body.notes;

  if (Object.keys(update).length === 0) {
    return json({ error: 'Keine Änderungen übergeben.' }, 422);
  }

  const { data, error } = await supabase
    .from('leads')
    .update(update)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    console.error('[api/leads] Update fehlgeschlagen:', error.message);
    return json({ error: 'Konnte die Anfrage nicht speichern.' }, 500);
  }

  return json({ ok: true, lead: data });
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
