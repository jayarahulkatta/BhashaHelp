import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
    const [key, ...values] = trimmed.split('=');
    process.env[key.trim()] = values.join('=').trim();
  });
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase URL or Service Role Key missing in .env.local');
  process.exit(1);
}

if (!geminiApiKey) {
  console.error('Error: GEMINI_API_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SchemeSeedInput {
  scheme_code: string;
  name_en: string;
  category: string;
  level: 'central' | 'state';
  nodal_ministry_or_dept?: string | null;
  applicable_states: string[];
  description_en: string;
  benefits_en: string;
  application_process_en?: string | null;
  required_documents?: string[];
  official_url: string;
  source: 'myscheme' | 'data.gov.in' | 'india.gov.in' | 'official';
  eligibility_criteria?: Record<string, unknown>;
  is_active?: boolean;
  last_verified_at: string;
  verified_by: string;
  translations: Array<{
    language_code: 'en' | 'hi' | 'te';
    name: string;
    description: string;
    benefits: string;
    eligibility_summary: string;
    needs_review?: boolean;
  }>;
}

async function fetchEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${geminiApiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${embeddingModel}`,
      content: { parts: [{ text }] },
      outputDimensionality: 768,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini embedding request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.embedding?.values) throw new Error(`No embedding values returned: ${JSON.stringify(data)}`);
  return data.embedding.values;
}

function embeddingText(scheme: SchemeSeedInput) {
  return [
    scheme.name_en,
    scheme.description_en,
    scheme.benefits_en,
    scheme.application_process_en,
    JSON.stringify(scheme.eligibility_criteria ?? {}),
  ].filter(Boolean).join('\n');
}

async function seedSchemes() {
  console.log('Starting scheme database seeding process...');

  const dataFilePath = path.join(process.cwd(), 'scripts', 'data', 'schemes-data.json');
  if (!fs.existsSync(dataFilePath)) {
    console.error(`Data file not found at ${dataFilePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataFilePath, 'utf8');
  const payload = JSON.parse(rawData);
  const schemes: SchemeSeedInput[] = Array.isArray(payload) ? payload : payload.schemes;
  if (!Array.isArray(schemes) || schemes.length === 0) throw new Error('Expected a non-empty schemes array.');

  const rows = [];
  for (let i = 0; i < schemes.length; i++) {
    const scheme = schemes[i];
    console.log(`[${i + 1}/${schemes.length}] Embedding ${scheme.scheme_code}: ${scheme.name_en}`);
    rows.push({ ...scheme, content_embedding: await fetchEmbedding(embeddingText(scheme)) });
  }

  const { error } = await supabase.rpc('import_schemes_batch', { p_rows: rows });
  if (error) throw error;

  console.log(`Seed complete. Imported or updated ${rows.length} scheme(s).`);
}

seedSchemes().catch((err) => {
  console.error('Unhandled error during seeding:', err instanceof Error ? err.message : err);
  process.exit(1);
});
