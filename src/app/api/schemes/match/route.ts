import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireUser } from '@/lib/server-auth';
import { languageSchema } from '@/lib/scheme-schemas';
import { z } from 'zod';

const requestSchema = z.object({ language: languageSchema.optional() });

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = getServiceSupabase();
  const { data: profile } = await db.from('user_preferences').select('preferred_language').eq('id', user.id).maybeSingle();
  const language = parsed.data.language ?? profile?.preferred_language ?? 'te';
  const { data: matches, error } = await db.rpc('match_schemes', { p_user_id: user.id });
  if (error) return NextResponse.json({ error: 'Unable to match schemes' }, { status: 500 });
  const ids = (matches ?? []).map((match: { scheme_id: string }) => match.scheme_id);
  if (!ids.length) return NextResponse.json({ schemes: [] });
  const { data: schemes, error: schemesError } = await db.from('schemes').select('id, scheme_code, category, level, official_url, last_verified_at, name_en, description_en, benefits_en, application_process_en, required_documents, eligibility_criteria, scheme_translations(language_code,name,description,benefits,eligibility_summary)').in('id', ids);
  if (schemesError) return NextResponse.json({ error: 'Unable to load matched schemes' }, { status: 500 });
  const byId = new Map((schemes ?? []).map((scheme) => [scheme.id, scheme]));
  return NextResponse.json({ schemes: (matches ?? []).map((match: { scheme_id: string; match_score: number; matched_reasons: string[] }) => {
    const scheme = byId.get(match.scheme_id) as Record<string, unknown>;
    const translations = (scheme.scheme_translations as Array<Record<string, string>>) ?? [];
    const translated = translations.find((translation) => translation.language_code === language) ?? translations.find((translation) => translation.language_code === 'en');
    return { ...scheme, name: translated?.name ?? scheme.name_en, description: translated?.description ?? scheme.description_en, benefits: translated?.benefits ?? scheme.benefits_en, eligibility_summary: translated?.eligibility_summary, match_score: match.match_score, matched_reasons: match.matched_reasons };
  }) });
}
