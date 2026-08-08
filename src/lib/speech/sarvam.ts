import { SpeechProvider, SpeechLanguage, TranscribeResult, SynthesizeResult, SpeechServiceError } from './provider';

const SARVAM_API_URL = 'https://api.sarvam.ai';

const SARVAM_LANG_MAP: Record<SpeechLanguage, string> = {
  hi: 'hi-IN',
  te: 'te-IN',
  en: 'en-IN',
};

const REVERSE_LANG_MAP: Record<string, SpeechLanguage> = {
  'hi-IN': 'hi',
  'te-IN': 'te',
  'en-IN': 'en',
  hi: 'hi',
  te: 'te',
  en: 'en',
};

function requireApiKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    throw new SpeechServiceError('SARVAM_API_KEY is not configured', 'CONFIG_MISSING');
  }
  return key;
}

function resolveLang(lang: SpeechLanguage): string {
  return SARVAM_LANG_MAP[lang] ?? lang;
}

async function sarvamPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const apiKey = requireApiKey();
  const res = await fetch(`${SARVAM_API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => 'unknown');
    throw new SpeechServiceError(
      `Sarvam API error (${res.status}): ${errorText}`,
      'API_ERROR',
    );
  }

  return res.json() as Promise<T>;
}

export class SarvamSpeechProvider implements SpeechProvider {
  readonly name = 'sarvam';

  async transcribe(audioBase64: string, languageHint?: SpeechLanguage): Promise<TranscribeResult> {
    if (!audioBase64) {
      throw new SpeechServiceError('Audio data is empty', 'EMPTY_RESPONSE');
    }

    const apiKey = requireApiKey();

    // Decode base64 to binary and wrap in a Blob for multipart upload
    const buffer = Buffer.from(audioBase64, 'base64');
    const audioBlob = new Blob([buffer], { type: 'audio/webm' });

    // Sarvam STT requires multipart/form-data with field named "file"
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'saarika:v2.5');

    if (languageHint) {
      formData.append('language_code', resolveLang(languageHint));
    }

    // Do NOT set Content-Type — fetch sets the multipart boundary automatically
    const res = await fetch(`${SARVAM_API_URL}/speech-to-text`, {
      method: 'POST',
      headers: {
        'api-subscription-key': apiKey,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      throw new SpeechServiceError(
        `Sarvam STT error (${res.status}): ${errorText}`,
        'API_ERROR',
      );
    }

    const data = await res.json() as { transcript: string; language_code: string };
    const detectedLang = REVERSE_LANG_MAP[data.language_code] ?? languageHint ?? 'en';

    return {
      text: data.transcript,
      language: detectedLang,
    };
  }

  async translate(text: string, sourceLang: SpeechLanguage, targetLang: SpeechLanguage): Promise<string> {
    if (sourceLang === targetLang) {
      return text;
    }

    const data = await sarvamPost<{ translated_text: string }>(
      '/translate',
      {
        input: { text },
        config: {
          source_language: resolveLang(sourceLang),
          target_language: resolveLang(targetLang),
          model: 'mayura:v2',
        },
      },
    );

    return data.translated_text;
  }

  async synthesize(text: string, language: SpeechLanguage): Promise<SynthesizeResult> {
    if (!text.trim()) {
      throw new SpeechServiceError('Text is empty', 'EMPTY_RESPONSE');
    }

    const data = await sarvamPost<{ audio_base64: string }>(
      '/text-to-speech',
      {
        input: { text },
        config: {
          language: resolveLang(language),
          model: 'bulbul:v1',
          voice: 'meera',
        },
      },
    );

    return {
      audioBase64: data.audio_base64,
      mimeType: 'audio/wav',
    };
  }
}
