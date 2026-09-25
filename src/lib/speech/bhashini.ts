import { SpeechProvider, SpeechLanguage, TranscribeResult, SynthesizeResult, SpeechServiceError } from './provider';

interface CachedPipeline {
  inferenceApiKey: string;
  callbackUrl: string;
  serviceIds: {
    asr: Record<string, string>;
    translation: Record<string, string>;
    tts: Record<string, string>;
  };
}

let pipelineCache: CachedPipeline | null = null;

async function getPipelineConfig(): Promise<CachedPipeline> {
  if (pipelineCache) return pipelineCache;

  const userId = process.env.BHASHINI_USER_ID;
  const apiKey = process.env.BHASHINI_API_KEY;

  if (!userId || !apiKey) {
    throw new SpeechServiceError('BHASHINI_USER_ID and BHASHINI_API_KEY must be set', 'CONFIG_MISSING');
  }

  try {
    const res = await fetch('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        userID: userId,
        ulcaApiKey: apiKey,
      },
      body: JSON.stringify({
        pipelineTasks: [{ taskType: 'asr' }, { taskType: 'translation' }, { taskType: 'tts' }],
        pipelineRequestConfig: { pipelineId: '64392f96daac500b55c543cd' }
      }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown');
      throw new Error(`Pipeline config error (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    const inferenceApiKey = data.pipelineInferenceAPIEndPoint?.inferenceApiKey?.value;
    const callbackUrl = data.pipelineInferenceAPIEndPoint?.callbackUrl;

    if (!inferenceApiKey || !callbackUrl) {
      throw new Error('Invalid pipeline config response: missing endpoint or key');
    }

    if (!callbackUrl.startsWith('https://')) {
      throw new Error('Security Error: callbackUrl must start with https://');
    }

    const serviceIds = {
      asr: {} as Record<string, string>,
      translation: {} as Record<string, string>,
      tts: {} as Record<string, string>,
    };

    const configs = data.pipelineResponseConfig || [];
    for (const task of configs) {
      const taskType = task.taskType as 'asr' | 'translation' | 'tts';
      if (!serviceIds[taskType]) continue;

      const taskConfigs = task.config || [];
      for (const config of taskConfigs) {
        const lang = config.language;
        if (!lang || !config.serviceId) continue;
        
        let key = lang.sourceLanguage;
        if (taskType === 'translation' && lang.targetLanguage) {
          key = `${lang.sourceLanguage}-${lang.targetLanguage}`;
        }
        
        if (!serviceIds[taskType][key]) {
          serviceIds[taskType][key] = config.serviceId;
        }
      }
    }

    pipelineCache = { inferenceApiKey, callbackUrl, serviceIds };
    return pipelineCache;
  } catch (error) {
    if (error instanceof SpeechServiceError) throw error;
    throw new SpeechServiceError(`Bhashini config failed: ${(error as Error).message}`, 'CONFIG_MISSING');
  }
}

export class BhashiniSpeechProvider implements SpeechProvider {
  readonly name = 'bhashini';

  async transcribe(audioBase64: string, languageHint?: SpeechLanguage): Promise<TranscribeResult> {
    const config = await getPipelineConfig();
    const sourceLanguage = languageHint || 'hi';
    const serviceId = config.serviceIds.asr[sourceLanguage];

    if (!serviceId) {
       throw new SpeechServiceError(`No ASR serviceId found for language: ${sourceLanguage}`, 'UNSUPPORTED_LANGUAGE');
    }

    try {
      const res = await fetch(config.callbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': config.inferenceApiKey,
          'Content-Type': 'application/json',
          'Accept': '*/*'
        },
        body: JSON.stringify({
          pipelineTasks: [{
            taskType: "asr",
            config: { language: { sourceLanguage }, serviceId, audioFormat: "wav", samplingRate: 16000 }
          }],
          inputData: { audio: [{ audioContent: audioBase64 }] }
        })
      });

      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown');
        throw new Error(`HTTP ${res.status}: ${err}`);
      }

      const data = await res.json();
      const text = data.pipelineResponse?.[0]?.output?.[0]?.source;

      if (!text) {
        throw new SpeechServiceError('No transcript returned', 'EMPTY_RESPONSE');
      }

      return { text, language: sourceLanguage };
    } catch (error) {
      if (error instanceof SpeechServiceError) throw error;
      throw new SpeechServiceError(`Bhashini ASR inference failed: ${(error as Error).message}`, 'API_ERROR');
    }
  }

  async translate(text: string, sourceLang: SpeechLanguage, targetLang: SpeechLanguage): Promise<string> {
    if (sourceLang === targetLang) return text;
    
    const config = await getPipelineConfig();
    const langKey = `${sourceLang}-${targetLang}`;
    const serviceId = config.serviceIds.translation[langKey];

    if (!serviceId) {
       throw new SpeechServiceError(`No Translation serviceId found for languages: ${langKey}`, 'UNSUPPORTED_LANGUAGE');
    }

    try {
      const res = await fetch(config.callbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': config.inferenceApiKey,
          'Content-Type': 'application/json',
          'Accept': '*/*'
        },
        body: JSON.stringify({
          pipelineTasks: [{
            taskType: "translation",
            config: { language: { sourceLanguage: sourceLang, targetLanguage: targetLang }, serviceId }
          }],
          inputData: { input: [{ source: text }] }
        })
      });

      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown');
        throw new Error(`HTTP ${res.status}: ${err}`);
      }

      const data = await res.json();
      const translatedText = data.pipelineResponse?.[0]?.output?.[0]?.target;

      if (!translatedText) {
        throw new SpeechServiceError('No translation returned', 'EMPTY_RESPONSE');
      }

      return translatedText;
    } catch (error) {
      if (error instanceof SpeechServiceError) throw error;
      throw new SpeechServiceError(`Bhashini translation inference failed: ${(error as Error).message}`, 'API_ERROR');
    }
  }

  async synthesize(text: string, language: SpeechLanguage): Promise<SynthesizeResult> {
    const config = await getPipelineConfig();
    const serviceId = config.serviceIds.tts[language];

    if (!serviceId) {
       throw new SpeechServiceError(`No TTS serviceId found for language: ${language}`, 'UNSUPPORTED_LANGUAGE');
    }

    try {
      const res = await fetch(config.callbackUrl, {
        method: 'POST',
        headers: {
          'Authorization': config.inferenceApiKey,
          'Content-Type': 'application/json',
          'Accept': '*/*'
        },
        body: JSON.stringify({
          pipelineTasks: [{
            taskType: "tts",
            config: { language: { sourceLanguage: language }, serviceId, gender: "female", samplingRate: 8000 }
          }],
          inputData: { input: [{ source: text }] }
        })
      });

      if (!res.ok) {
        const err = await res.text().catch(() => 'unknown');
        throw new Error(`HTTP ${res.status}: ${err}`);
      }

      const data = await res.json();
      const audioBase64 = data.pipelineResponse?.[0]?.audio?.[0]?.audioContent;

      if (!audioBase64) {
        throw new SpeechServiceError('No audio returned from TTS', 'EMPTY_RESPONSE');
      }

      return {
        audioBase64,
        mimeType: 'audio/wav',
      };
    } catch (error) {
      if (error instanceof SpeechServiceError) throw error;
      throw new SpeechServiceError(`Bhashini TTS inference failed: ${(error as Error).message}`, 'API_ERROR');
    }
  }
}

