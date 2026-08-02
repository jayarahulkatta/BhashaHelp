import { NextResponse } from 'next/server';
import { validateServerConfig } from '@/lib/config';
import { z } from 'zod';

const ttsSchema = z.object({
  text: z.string().min(1, 'Text is required'),
  lang: z.enum(['en', 'te', 'hi'])
});

// Maps our internal lang codes to Bhashini standard lang codes
const langMap: Record<string, string> = {
  'en': 'en',
  'hi': 'hi',
  'te': 'te',
};

// Bhashini TTS requires specific service IDs depending on the language family or model pipeline.
const ttsServiceIds: Record<string, string> = {
  'en': 'ai4bharat/indic-tts-coqui-misc',
  'hi': 'ai4bharat/indic-tts-coqui-indo_aryan',
  'te': 'ai4bharat/indic-tts-coqui-dravidian',
};

export async function POST(request: Request) {
  try {
    const config = validateServerConfig();
    const body = await request.json();
    
    const parsed = ttsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    
    const { text, lang } = parsed.data;

    const sourceLanguage = langMap[lang];
    if (!sourceLanguage) {
      return NextResponse.json({ error: 'Unsupported language' }, { status: 400 });
    }

    const serviceId = ttsServiceIds[lang];

    // Assuming Dhruva Inference API
    const bhashiniUrl = 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline';

    const payload = {
      pipelineTasks: [
        {
          taskType: 'tts',
          config: {
            language: {
              sourceLanguage,
            },
            serviceId,
            gender: 'female', // Optional, depends on the model
            samplingRate: 16000
          }
        }
      ],
      inputData: {
        input: [
          {
            source: text
          }
        ]
      }
    };

    const response = await fetch(bhashiniUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': config.BHASHINI_API_KEY,
        // Depending on the exact API version, it might expect these in headers instead
        // 'userID': config.BHASHINI_USER_ID,
        // 'ulcaApiKey': config.BHASHINI_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Bhashini API Error:', data);
      return NextResponse.json({ error: 'TTS Service Error' }, { status: 502 });
    }

    // Usually Bhashini returns audio content as base64 in pipelineResponse
    const audioContent = data.pipelineResponse?.[0]?.audio?.[0]?.audioContent;

    if (!audioContent) {
      return NextResponse.json({ error: 'No audio returned' }, { status: 500 });
    }

    return NextResponse.json({ audioContent });

  } catch (error) {
    console.error('TTS Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
