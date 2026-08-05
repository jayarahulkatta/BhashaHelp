import { SpeechProvider, TranscribeResult, SynthesizeResult, SpeechServiceError } from './provider';

/**
 * BhashiniSpeechProvider — stub implementation.
 *
 * Bhashini govt API access is pending approval. Once approved, implement
 * each method using the Dhruva pipeline API at:
 *   https://dhruva-api.bhashini.gov.in/services/inference/pipeline
 *
 * See the existing src/app/api/tts/route.ts for the raw Bhashini request
 * pattern to follow.
 */
export class BhashiniSpeechProvider implements SpeechProvider {
  readonly name = 'bhashini';

  async transcribe(): Promise<TranscribeResult> {
    // TODO: implement with Dhruva ASR pipeline once API access is approved
    throw new SpeechServiceError(
      'Bhashini STT is not yet available — pending govt API access',
      'CONFIG_MISSING',
    );
  }

  async translate(): Promise<string> {
    // TODO: implement with Dhruva translation pipeline once API access is approved
    throw new SpeechServiceError(
      'Bhashini translation is not yet available — pending govt API access',
      'CONFIG_MISSING',
    );
  }

  async synthesize(): Promise<SynthesizeResult> {
    // TODO: implement with Dhruva TTS pipeline once API access is approved
    throw new SpeechServiceError(
      'Bhashini TTS is not yet available — pending govt API access',
      'CONFIG_MISSING',
    );
  }
}
