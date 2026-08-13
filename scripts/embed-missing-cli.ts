import { getEmbedding } from '../src/lib/gemini';
import { getServiceSupabase } from '../src/lib/supabase';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  console.log('Starting missing embeddings generation...');
  const db = getServiceSupabase();

  try {
    const { data: schemes, error: fetchError } = await db
      .from('schemes')
      .select('id, name_en, description_en, benefits_en, scheme_translations(eligibility_summary, language_code)')
      .is('content_embedding', null);

    if (fetchError) {
      throw fetchError;
    }

    if (!schemes || schemes.length === 0) {
      console.log('No schemes found with missing embeddings.');
      return;
    }

    console.log(`Found ${schemes.length} schemes missing embeddings. Processing...`);

    let processedCount = 0;
    const errors = [];

    for (const scheme of schemes) {
      try {
        const translations = scheme.scheme_translations as any;
        const enTranslation = Array.isArray(translations) 
            ? translations.find((t: any) => t.language_code === 'en')
            : (translations?.language_code === 'en' ? translations : null);
        
        const eligibilitySummary = enTranslation?.eligibility_summary || '';

        const textToEmbed = [
          scheme.name_en,
          scheme.description_en,
          scheme.benefits_en,
          eligibilitySummary
        ].filter(Boolean).join('\n');

        const embedding = await getEmbedding(textToEmbed);

        const { error: updateError } = await db
          .from('schemes')
          .update({ content_embedding: embedding })
          .eq('id', scheme.id);

        if (updateError) throw updateError;
        processedCount++;
        
        console.log(`[${processedCount}/${schemes.length}] Processed scheme ID: ${scheme.id}`);
        
        // Delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Failed to process scheme ID ${scheme.id}:`, err);
        errors.push({ id: scheme.id, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    console.log(`\nProcessing complete!`);
    console.log(`Successfully processed: ${processedCount}`);
    if (errors.length > 0) {
      console.log(`Errors encountered: ${errors.length}`);
      console.log(errors);
    }
  } catch (error) {
    console.error('Embed missing script failed:', error);
  }
}

main();
