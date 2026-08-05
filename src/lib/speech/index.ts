import { SpeechProvider, SpeechServiceError } from './provider';
import { SarvamSpeechProvider } from './sarvam';
import { BhashiniSpeechProvider } from './bhashini';

let cachedProvider: SpeechProvider | null = null;

export function getSpeechProvider(): SpeechProvider {
  if (cachedProvider) return cachedProvider;

  const name = (process.env.SPEECH_PROVIDER ?? 'sarvam').toLowerCase();

  switch (name) {
    case 'sarvam':
      cachedProvider = new SarvamSpeechProvider();
      break;
    case 'bhashini':
      cachedProvider = new BhashiniSpeechProvider();
      break;
    default:
      throw new SpeechServiceError(
        `Unknown speech provider "${name}". Expected "sarvam" or "bhashini".`,
        'CONFIG_MISSING',
      );
  }

  return cachedProvider;
}

export type { SpeechProvider, SpeechLanguage, TranscribeResult, SynthesizeResult, SpeechServiceError } from './provider';
