/**
 * Retrieval quality evaluation script.
 * Runs the eval/queries.json dataset against the embedding + match pipeline
 * and reports precision, recall and abstain rates.
 *
 * Usage: npx tsx scripts/eval-retrieval.ts
 * Requires: GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env
import 'dotenv/config';

async function getEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
  if (!apiKey) throw new Error('GEMINI_API_KEY is required');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${model}`,
      content: { parts: [{ text }] },
      outputDimensionality: 768
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Embedding failed: ${response.status} ${errText}`);
  }
  const data = await response.json();
  return data.embedding.values;
}

async function matchSchemes(embedding: number[], threshold: number, limit: number) {
  const { createClient } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  // Use a direct semantic match without user filtering for eval
  const { data, error } = await supabase.rpc('match_eligible_schemes_semantic', {
    p_user_id: null,
    p_query_embedding: embedding,
    p_threshold: threshold,
    p_limit: limit
  });

  if (error) throw error;
  return data || [];
}

interface EvalQuery {
  query: string;
  lang: string;
  expected_category?: string;
}

interface EvalResult {
  query: string;
  lang: string;
  expected_category?: string;
  top_similarity: number | null;
  match_count: number;
  confidence: 'confident' | 'low_confidence' | 'no_match';
  pass: boolean;
}

async function main() {
  const queriesPath = resolve(__dirname, '../eval/queries.json');
  const dataset = JSON.parse(readFileSync(queriesPath, 'utf-8'));

  const THRESHOLD = 0.55;
  const LOW_CONFIDENCE = 0.65;
  const LIMIT = 5;
  const DELAY_MS = 500; // Rate limit friendly

  console.log('=== BhashaHelp Retrieval Evaluation ===\n');
  console.log(`Threshold: ${THRESHOLD}, Low confidence: ${LOW_CONFIDENCE}, Limit: ${LIMIT}`);
  console.log(`In-scope queries: ${dataset.in_scope.length}, Out-of-scope: ${dataset.out_of_scope.length}\n`);

  // --- In-scope queries ---
  console.log('--- IN-SCOPE QUERIES ---');
  const inScopeResults: EvalResult[] = [];

  for (const q of dataset.in_scope as EvalQuery[]) {
    try {
      const embedding = await getEmbedding(q.query);
      const matches = await matchSchemes(embedding, THRESHOLD, LIMIT);
      const topSim = matches[0]?.similarity ?? null;
      const confidence = topSim === null ? 'no_match' as const
        : topSim < LOW_CONFIDENCE ? 'low_confidence' as const
        : 'confident' as const;

      const result: EvalResult = {
        query: q.query,
        lang: q.lang,
        expected_category: q.expected_category,
        top_similarity: topSim ? parseFloat(topSim.toFixed(4)) : null,
        match_count: matches.length,
        confidence,
        pass: matches.length > 0  // In-scope should match
      };

      inScopeResults.push(result);
      const icon = result.pass ? '✅' : '❌';
      console.log(`  ${icon} [${result.confidence}] sim=${result.top_similarity ?? 'N/A'} matches=${result.match_count} "${q.query.substring(0, 50)}..."`);

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (err) {
      console.error(`  ⚠️ Error: "${q.query.substring(0, 50)}": ${(err as Error).message}`);
    }
  }

  // --- Out-of-scope queries ---
  console.log('\n--- OUT-OF-SCOPE QUERIES ---');
  const outOfScopeResults: EvalResult[] = [];

  for (const q of dataset.out_of_scope as EvalQuery[]) {
    try {
      const embedding = await getEmbedding(q.query);
      const matches = await matchSchemes(embedding, THRESHOLD, LIMIT);
      const topSim = matches[0]?.similarity ?? null;
      const confidence = topSim === null ? 'no_match' as const
        : topSim < LOW_CONFIDENCE ? 'low_confidence' as const
        : 'confident' as const;

      const result: EvalResult = {
        query: q.query,
        lang: q.lang,
        top_similarity: topSim ? parseFloat(topSim.toFixed(4)) : null,
        match_count: matches.length,
        confidence,
        pass: matches.length === 0  // Out-of-scope should NOT match
      };

      outOfScopeResults.push(result);
      const icon = result.pass ? '✅' : '❌';
      console.log(`  ${icon} [${result.confidence}] sim=${result.top_similarity ?? 'N/A'} matches=${result.match_count} "${q.query.substring(0, 50)}..."`);

      await new Promise(r => setTimeout(r, DELAY_MS));
    } catch (err) {
      console.error(`  ⚠️ Error: "${q.query.substring(0, 50)}": ${(err as Error).message}`);
    }
  }

  // --- Summary ---
  const inScopePass = inScopeResults.filter(r => r.pass).length;
  const outOfScopePass = outOfScopeResults.filter(r => r.pass).length;
  const inScopeConfident = inScopeResults.filter(r => r.confidence === 'confident').length;
  const inScopeLow = inScopeResults.filter(r => r.confidence === 'low_confidence').length;

  console.log('\n=== SUMMARY ===');
  console.log(`In-scope recall:      ${inScopePass}/${inScopeResults.length} (${((inScopePass / inScopeResults.length) * 100).toFixed(1)}%)`);
  console.log(`  - Confident:        ${inScopeConfident}/${inScopeResults.length}`);
  console.log(`  - Low confidence:   ${inScopeLow}/${inScopeResults.length}`);
  console.log(`Out-of-scope abstain: ${outOfScopePass}/${outOfScopeResults.length} (${((outOfScopePass / outOfScopeResults.length) * 100).toFixed(1)}%)`);

  const totalPass = inScopePass + outOfScopePass;
  const totalTotal = inScopeResults.length + outOfScopeResults.length;
  console.log(`Overall accuracy:     ${totalPass}/${totalTotal} (${((totalPass / totalTotal) * 100).toFixed(1)}%)`);

  // Exit with error if accuracy is below 70%
  if ((totalPass / totalTotal) < 0.7) {
    console.error('\n❌ Retrieval quality is below 70% threshold');
    process.exit(1);
  }
  console.log('\n✅ Retrieval quality meets threshold');
}

main().catch(err => {
  console.error('Eval failed:', err);
  process.exit(1);
});
