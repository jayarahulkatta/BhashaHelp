export type SpeechLanguage = 'hi' | 'te' | 'en';

export interface TranscribeResult {
  text: string;
  language: SpeechLanguage;
}

export interface SynthesizeResult {
  audioBase64: string;
  mimeType: string;
}

export class SpeechServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'UNSUPPORTED_LANGUAGE' | 'API_ERROR' | 'NETWORK_ERROR' | 'EMPTY_RESPONSE' | 'CONFIG_MISSING',
  ) {
    super(message);
    this.name = 'SpeechServiceError';
  }
}

export interface SpeechProvider {
  readonly name: string;

  transcribe(audioBase64: string, languageHint?: SpeechLanguage): Promise<TranscribeResult>;

  translate(text: string, sourceLang: SpeechLanguage, targetLang: SpeechLanguage): Promise<string>;

  synthesize(text: string, language: SpeechLanguage): Promise<SynthesizeResult>;
}
