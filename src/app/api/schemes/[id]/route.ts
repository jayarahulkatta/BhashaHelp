import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { languageSchema } from '@/lib/scheme-schemas';

export async function GET(request: Request, context: RouteContext<'/api/schemes/[id]'>) {
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invalid scheme id' }, { status: 400 });
  const language = languageSchema.catch('en').parse(new URL(request.url).searchParams.get('language'));
  const { data, error } = await getServiceSupabase().from('schemes').select('id, scheme_code, category, level, nodal_ministry_or_dept, applicable_states, description_en, benefits_en, application_process_en, required_documents, official_url, eligibility_criteria, last_verified_at, scheme_translations(language_code,name,description,benefits,eligibility_summary)').eq('id', id).eq('is_active', true).maybeSingle();
  if (error) return NextResponse.json({ error: 'Unable to load scheme' }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Scheme not found' }, { status: 404 });
  const translations = data.scheme_translations ?? [];
  const translation = translations.find((item) => item.language_code === language) ?? translations.find((item) => item.language_code === 'en');
  return NextResponse.json({ ...data, name: translation?.name, description: translation?.description ?? data.description_en, benefits: translation?.benefits ?? data.benefits_en, eligibility_summary: translation?.eligibility_summary });
}
