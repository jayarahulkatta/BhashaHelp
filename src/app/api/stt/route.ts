import { NextResponse } from 'next/server';
import { getSpeechProvider } from '@/lib/speech';
import { checkRateLimitAsync } from '@/lib/auth';
import { z } from 'zod';

// 2MB in base64 is approximately 2.67MB of text
const MAX_AUDIO_BASE64_LENGTH = 2_800_000;

const sttSchema = z.object({
  audio: z.string().min(1, 'Audio base64 is required').max(MAX_AUDIO_BASE64_LENGTH, 'Audio too large'),
  lang: z.enum(['en', 'te', 'hi']),
});

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown-ip';

    // Rate limit: 30 STT requests per hour per IP
    if (!(await checkRateLimitAsync(`stt:ip:${ip}`, 30, 60 * 60 * 1000))) {
      return NextResponse.json(
        { error: 'Too many transcription requests. Please try again later.' },
        { status: 429 },
      );
    }

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

    // 15s timeout for STT
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const result = await provider.transcribe(audio, lang);
      return NextResponse.json(result);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Transcription timed out. Please try a shorter recording.' },
        { status: 504 },
      );
    }
    const code = (error as Error & { code?: string })?.code || 'STT_ERROR';
    const status = code === 'AUDIO_TOO_LARGE' ? 413 : code === 'UNSUPPORTED_LANGUAGE' ? 400 : 500;
    return NextResponse.json(
      { error: (error as Error)?.message || 'Speech-to-text failed', code },
      { status },
    );
  }
}
