import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEmbedding } from '@/lib/gemini';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/server-auth';
import { schemeWithTranslationsSchema } from '@/lib/scheme-schemas';

const idSchema = z.object({ id: z.string().uuid() });
const updateSchema = schemeWithTranslationsSchema.extend({ id: z.string().uuid() });
const embeddingText = (scheme: { name_en: string; description_en: string; benefits_en: string; eligibility_criteria: unknown }) => [scheme.name_en, scheme.description_en, scheme.benefits_en, JSON.stringify(scheme.eligibility_criteria)].join('\n');

async function saveScheme(input: z.infer<typeof schemeWithTranslationsSchema>, id?: string) {
  const db = getServiceSupabase();
  const embedding = await getEmbedding(embeddingText(input));
  const { translations, ...scheme } = input;
  const query = id ? db.from('schemes').update({ ...scheme, content_embedding: embedding }).eq('id', id) : db.from('schemes').insert({ ...scheme, content_embedding: embedding });
  const { data, error } = await query.select('id').single();
  if (error) throw error;
  const { error: translationError } = await db.from('scheme_translations').upsert(translations.map((translation) => ({ ...translation, scheme_id: data.id })), { onConflict: 'scheme_id,language_code' });
  if (translationError) throw translationError;
  return data.id;
}

export async function POST(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const parsed = schemeWithTranslationsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try { return NextResponse.json({ id: await saveScheme(parsed.data) }, { status: 201 }); }
  catch (error) { console.error('Create scheme failed:', error); return NextResponse.json({ error: 'Unable to save scheme' }, { status: 500 }); }
}

export async function PUT(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { id, ...input } = parsed.data;
  try { return NextResponse.json({ id: await saveScheme(input, id) }); }
  catch (error) { console.error('Update scheme failed:', error); return NextResponse.json({ error: 'Unable to update scheme' }, { status: 500 }); }
}

export async function DELETE(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const parsed = idSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const { error } = await getServiceSupabase().from('schemes').delete().eq('id', parsed.data.id);
  return error ? NextResponse.json({ error: 'Unable to delete scheme' }, { status: 500 }) : new NextResponse(null, { status: 204 });
}
