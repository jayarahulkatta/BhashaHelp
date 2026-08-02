import { z } from 'zod';

const publicSupabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const optionalPublicSupabaseEnv = publicSupabaseSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

function requireEnv(name: string): string {
  const parsed = z.string().min(1).safeParse(process.env[name]);

  if (!parsed.success) {
    throw new Error(`${name} is missing`);
  }

  return parsed.data;
}

export function getOptionalPublicSupabaseConfig() {
  if (!optionalPublicSupabaseEnv.success) {
    return null;
  }

  return {
    url: optionalPublicSupabaseEnv.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: optionalPublicSupabaseEnv.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getPublicSupabaseConfig() {
  const parsed = publicSupabaseSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    throw new Error('Supabase public environment variables are missing');
  }

  return {
    url: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getServiceSupabaseConfig() {
  return {
    ...getPublicSupabaseConfig(),
    serviceRoleKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  };
}

export function getGeminiConfig() {
  return {
    apiKey: requireEnv('GEMINI_API_KEY'),
    generationModel: process.env.GEMINI_GENERATION_MODEL || 'gemini-flash-latest',
    embeddingModel: process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
  };
}

export function getTwoFactorConfig() {
  return {
    apiKey: requireEnv('TWOFACTOR_API_KEY'),
  };
}

export function getBhashiniConfig() {
  return {
    apiKey: requireEnv('BHASHINI_API_KEY'),
    userId: requireEnv('BHASHINI_USER_ID'),
  };
}
