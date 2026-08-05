import { NextResponse } from 'next/server';
import { getSpeechProvider } from '@/lib/speech';
import { z } from 'zod';

const sttSchema = z.object({
  audio: z.string().min(1, 'Audio base64 is required'),
  lang: z.enum(['en', 'te', 'hi']),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const parsed = sttSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { audio, lang } = parsed.data;

    const provider = getSpeechProvider();
    const result = await provider.transcribe(audio, lang);

    return NextResponse.json(result);
  } catch (error) {
    const code = (error as Error & { code?: string })?.code || 'STT_ERROR';
    const status = code === 'AUDIO_TOO_LARGE' ? 413 : code === 'UNSUPPORTED_LANGUAGE' ? 400 : 500;
    return NextResponse.json(
      { error: (error as Error)?.message || 'Speech-to-text failed', code },
      { status },
    );
  }
}
