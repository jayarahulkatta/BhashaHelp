import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEmbedding } from '@/lib/gemini';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/server-auth';
import { schemeWithTranslationsSchema } from '@/lib/scheme-schemas';

const batchSchema = z.object({ schemes: z.array(schemeWithTranslationsSchema).min(1).max(300) });

export async function POST(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const rows = await Promise.all(parsed.data.schemes.map(async (scheme) => ({ ...scheme, content_embedding: await getEmbedding([scheme.name_en, scheme.description_en, scheme.benefits_en, JSON.stringify(scheme.eligibility_criteria)].join('\n')) })));
    const { error } = await getServiceSupabase().rpc('import_schemes_batch', { p_rows: rows });
    if (error) throw error;
    return NextResponse.json({ imported: rows.length });
  } catch (error) { console.error('Seed import failed:', error); return NextResponse.json({ error: 'No schemes were imported' }, { status: 500 }); }
}
