import { NextResponse } from 'next/server';
import { getSpeechProvider } from '@/lib/speech';
import { z } from 'zod';

const ttsSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  lang: z.enum(['en', 'te', 'hi']),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = ttsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { text, lang } = parsed.data;

    const provider = getSpeechProvider();
    const result = await provider.synthesize(text, lang);

    return NextResponse.json({
      audioContent: result.audioBase64,
      mimeType: result.mimeType,
    });
  } catch (error) {
    const code = (error as Error & { code?: string })?.code || 'TTS_ERROR';
    const status = code === 'UNSUPPORTED_LANGUAGE' ? 400 : 500;
    return NextResponse.json(
      { error: (error as Error)?.message || 'Text-to-speech failed', code },
      { status },
    );
  }
}
