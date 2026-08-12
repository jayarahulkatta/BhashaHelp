import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/server-auth';

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const { data, error } = await getServiceSupabase().from('query_logs').select('query_text_raw, query_language, confidence_flag, created_at').in('confidence_flag', ['low_confidence', 'no_match']).order('created_at', { ascending: false }).limit(500);
  if (error) return NextResponse.json({ error: 'Unable to load curation gaps' }, { status: 500 });
  const gaps = Object.values((data ?? []).reduce<Record<string, { query: string | null; language: string | null; count: number; latest_at: string }>>((result, log) => {
    const key = `${log.query_language}:${log.query_text_raw}`;
    const current = result[key];
    result[key] = { query: log.query_text_raw, language: log.query_language, count: (current?.count ?? 0) + 1, latest_at: current?.latest_at ?? log.created_at };
    return result;
  }, {}));
  return NextResponse.json({ gaps });
}
