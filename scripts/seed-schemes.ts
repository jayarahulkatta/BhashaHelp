import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Simple .env.local loader
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...values] = trimmed.split('=');
        const val = values.join('=').trim();
        process.env[key.trim()] = val;
      }
    });
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: Supabase URL or Service Role Key missing in .env.local');
  process.exit(1);
}

if (!geminiApiKey) {
  console.error('❌ Error: GEMINI_API_KEY missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SchemeData {
  name: string;
  description: string;
  eligibility_criteria: string;
  benefits: string;
  application_process: string;
  source_url: string;
  last_verified_date: string;
  is_active: boolean;
}

async function fetchEmbedding(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${geminiApiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${embeddingModel}`,
      content: {
        parts: [{ text }]
      },
      outputDimensionality: 768
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini embedding request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  if (!data.embedding?.values) {
    throw new Error(`No embedding values returned in response: ${JSON.stringify(data)}`);
  }

  return data.embedding.values;
}

async function seedSchemes() {
  console.log('🚀 Starting scheme database seeding process...');

  const dataFilePath = path.join(process.cwd(), 'scripts', 'data', 'schemes-data.json');
  if (!fs.existsSync(dataFilePath)) {
    console.error(`❌ Data file not found at ${dataFilePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dataFilePath, 'utf8');
  const schemes: SchemeData[] = JSON.parse(rawData);

  console.log(`📦 Found ${schemes.length} schemes to seed.`);

  let insertedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < schemes.length; i++) {
    const scheme = schemes[i];
    console.log(`\n[${i + 1}/${schemes.length}] Processing: "${scheme.name}"`);

    const textToEmbed = `Scheme: ${scheme.name}
Description: ${scheme.description}
Eligibility: ${scheme.eligibility_criteria}
Benefits: ${scheme.benefits}
Application Process: ${scheme.application_process}`;

    try {
      console.log(`  Generating 768-dim embedding via ${embeddingModel}...`);
      const embedding = await fetchEmbedding(textToEmbed);
      console.log(`  ✓ Embedding generated (${embedding.length} dimensions)`);

      const { data: existing } = await supabase
        .from('schemes')
        .select('id')
        .eq('name', scheme.name)
        .maybeSingle();

      if (existing) {
        console.log(`  Updating existing scheme record (ID: ${existing.id})...`);
        const { error: updateError } = await supabase
          .from('schemes')
          .update({
            description: scheme.description,
            eligibility_criteria: scheme.eligibility_criteria,
            benefits: scheme.benefits,
            application_process: scheme.application_process,
            source_url: scheme.source_url,
            last_verified_date: scheme.last_verified_date,
            is_active: scheme.is_active,
            embedding: embedding
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`  ❌ Update error:`, updateError.message);
          errorCount++;
        } else {
          console.log(`  ✅ Successfully updated "${scheme.name}"`);
          insertedCount++;
        }
      } else {
        console.log(`  Inserting new scheme record...`);
        const { error: insertError } = await supabase
          .from('schemes')
          .insert({
            name: scheme.name,
            description: scheme.description,
            eligibility_criteria: scheme.eligibility_criteria,
            benefits: scheme.benefits,
            application_process: scheme.application_process,
            source_url: scheme.source_url,
            last_verified_date: scheme.last_verified_date,
            is_active: scheme.is_active,
            embedding: embedding
          });

        if (insertError) {
          console.error(`  ❌ Insert error:`, insertError.message);
          errorCount++;
        } else {
          console.log(`  ✅ Successfully inserted "${scheme.name}"`);
          insertedCount++;
        }
      }
    } catch (err) {
      console.error(`  ❌ Error processing scheme:`, err instanceof Error ? err.message : err);
      errorCount++;
    }
  }

  console.log('\n========================================');
  console.log(`🎉 Seeding Complete!`);
  console.log(`   Successful: ${insertedCount}`);
  console.log(`   Failed: ${errorCount}`);

  // Query database to verify final state
  const { data: verifyData, count, error: verifyError } = await supabase
    .from('schemes')
    .select('id, name, embedding', { count: 'exact' })
    .eq('is_active', true);

  if (verifyError) {
    console.error('❌ Failed to verify database contents:', verifyError.message);
  } else {
    console.log(`📊 Verification Result:`);
    console.log(`   Total active schemes in DB: ${count ?? verifyData?.length}`);
    const validEmbeddings = verifyData?.filter((s) => s.embedding !== null).length || 0;
    console.log(`   Schemes with valid embeddings: ${validEmbeddings}`);
  }
  console.log('========================================\n');
}

seedSchemes().catch((err) => {
  console.error('Unhandled error during seeding:', err);
  process.exit(1);
});
