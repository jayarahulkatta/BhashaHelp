import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getEmbedding } from '@/lib/gemini';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/server-auth';
import { schemeWithTranslationsSchema } from '@/lib/scheme-schemas';

type SchemeSeedInput = z.infer<typeof schemeWithTranslationsSchema>;
type SchemeSeedRow = SchemeSeedInput & { content_embedding: number[] };

const batchSchema = z.object({ schemes: z.array(schemeWithTranslationsSchema).min(1).max(300) });
const embeddingText = (scheme: SchemeSeedInput) => [
  scheme.name_en,
  scheme.description_en,
  scheme.benefits_en,
  scheme.application_process_en,
  JSON.stringify(scheme.eligibility_criteria),
].filter(Boolean).join('\n');

async function buildRows(schemes: SchemeSeedInput[]) {
  const rows: SchemeSeedRow[] = [];
  for (const scheme of schemes) {
    rows.push({ ...scheme, content_embedding: await getEmbedding(embeddingText(scheme)) });
  }
  return rows;
}

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  return NextResponse.json({
    schemes: [
      {
        scheme_code: 'TG-SCHEME-CODE',
        name_en: 'Official English scheme name',
        category: 'Benefits & Social Development',
        level: 'state',
        nodal_ministry_or_dept: 'Department or ministry name',
        applicable_states: ['Telangana'],
        description_en: 'Curator-verified description from the official source.',
        benefits_en: 'Curator-verified benefits, limits, and payment details.',
        application_process_en: 'Official application steps and where to apply.',
        required_documents: ['Aadhaar', 'Income certificate'],
        official_url: 'https://www.example.gov.in/scheme-page',
        source: 'official',
        eligibility_criteria: {
          age_min: 18,
          age_max: 60,
          gender: ['female'],
          category: ['SC', 'ST', 'BC', 'Minority'],
          area: ['rural', 'urban'],
          disability_required: false,
          minority_required: false,
          student_required: false,
        },
        is_active: true,
        last_verified_at: '2026-08-13',
        verified_by: 'curator-name',
        translations: [
          {
            language_code: 'te',
            name: 'Verified Telugu scheme name',
            description: 'Verified Telugu description.',
            benefits: 'Verified Telugu benefits.',
            eligibility_summary: 'Short Telugu eligibility summary.',
            needs_review: true,
          },
          {
            language_code: 'hi',
            name: 'Verified Hindi scheme name',
            description: 'Verified Hindi description.',
            benefits: 'Verified Hindi benefits.',
            eligibility_summary: 'Short Hindi eligibility summary.',
            needs_review: true,
          },
        ],
      },
    ],
  });
}

export async function POST(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  const parsed = batchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  try {
    const rows = await buildRows(parsed.data.schemes);
    const { error } = await getServiceSupabase().rpc('import_schemes_batch', { p_rows: rows });
    if (error) throw error;
    return NextResponse.json({ imported: rows.length, scheme_codes: rows.map((row) => row.scheme_code) }, { status: 201 });
  } catch (error) {
    console.error('Seed import failed:', error);
    return NextResponse.json({ error: 'No schemes were imported' }, { status: 500 });
  }
}
