// GET /admin/logout — meldet ab und leitet zum Login.
import type { APIRoute } from 'astro';
import { createSupabaseServer } from '../../lib/supabase';

export const prerender = false;

export const GET: APIRoute = async ({ cookies, request, redirect }) => {
  const supabase = createSupabaseServer(cookies, request);
  await supabase.auth.signOut();
  return redirect('/admin/login', 303);
};
