import { getGeminiConfig } from './config';

interface GeminiEmbeddingResponse {
  embedding: {
    values: number[];
  };
}

interface GeminiGenerateRequest {
  contents: Array<{
    parts: Array<{ text: string }>;
  }>;
  generationConfig: {
    temperature: number;
  };
  systemInstruction?: {
    parts: Array<{ text: string }>;
  };
}

export async function getEmbedding(text: string): Promise<number[]> {
  const config = getGeminiConfig();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.embeddingModel}:embedContent?key=${config.apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${config.embeddingModel}`,
      content: {
        parts: [{ text }]
      },
      outputDimensionality: 768
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Gemini Embedding Error:', errorData);
    throw new Error('Failed to generate embedding');
  }

  const data: GeminiEmbeddingResponse = await response.json();
  return data.embedding.values;
}

export async function generateText(prompt: string, systemInstruction?: string): Promise<string> {
  const config = getGeminiConfig();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.generationModel}:generateContent?key=${config.apiKey}`;
  
  const body: GeminiGenerateRequest = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.1, // Low temperature for deterministic RAG answers
    }
  };

  if (systemInstruction) {
    body.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('Gemini Generation Error:', errorData);
    throw new Error('Failed to generate text');
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
