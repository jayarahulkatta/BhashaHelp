import { getServiceSupabase } from '@/lib/supabase';

export async function requireUser(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await getServiceSupabase().auth.getUser(token);
  return error || !data.user ? null : data.user;
}

export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (!user) return null;
  const { data, error } = await getServiceSupabase().from('user_roles').select('id').eq('id', user.id).eq('role', 'admin').maybeSingle();
  return error || !data ? null : user;
}
