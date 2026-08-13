import { NextResponse } from 'next/server';
import { getEmbedding } from '@/lib/gemini';
import { getServiceSupabase } from '@/lib/supabase';
import { requireAdmin } from '@/lib/server-auth';

export async function POST(request: Request) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
  }

  const db = getServiceSupabase();

  try {
    // Fetch all schemes where content_embedding is null
    const { data: schemes, error: fetchError } = await db
      .from('schemes')
      .select('id, name_en, description_en, benefits_en, scheme_translations(eligibility_summary, language_code)')
      .is('content_embedding', null);

    if (fetchError) {
      throw fetchError;
    }

    if (!schemes || schemes.length === 0) {
      return NextResponse.json({ message: 'No schemes found with missing embeddings.', processed: 0 });
    }

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
        
        // Add a small delay to avoid hitting Gemini API rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`Failed to process scheme ID ${scheme.id}:`, err);
        errors.push({ id: scheme.id, error: err instanceof Error ? err.message : 'Unknown error' });
      }
    }

    return NextResponse.json({ 
      message: 'Processing complete', 
      processed: processedCount,
      total_found: schemes.length,
      errors
    });

  } catch (error) {
    console.error('Embed missing failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
