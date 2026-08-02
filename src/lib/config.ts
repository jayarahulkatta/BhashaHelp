import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(), // optional on client, required on server
  GEMINI_API_KEY: z.string().min(1).optional(),
  BHASHINI_API_KEY: z.string().min(1).optional(),
  BHASHINI_USER_ID: z.string().min(1).optional(),
  TWOFACTOR_API_KEY: z.string().min(1).optional(),
});

// We cast process.env to allow validation to catch missing keys.
const env = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  BHASHINI_API_KEY: process.env.BHASHINI_API_KEY,
  BHASHINI_USER_ID: process.env.BHASHINI_USER_ID,
  TWOFACTOR_API_KEY: process.env.TWOFACTOR_API_KEY,
});

if (!env.success) {
  console.error('Invalid environment variables:', env.error.format());
  throw new Error('Invalid environment variables');
}

export const config = env.data;

// Server-side specific validation (run this only in server context to ensure keys exist)
export function validateServerConfig() {
  const serverSchema = z.object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    GEMINI_API_KEY: z.string().min(1),
    BHASHINI_API_KEY: z.string().min(1),
    BHASHINI_USER_ID: z.string().min(1),
    TWOFACTOR_API_KEY: z.string().min(1),
  });
  
  const serverEnv = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    BHASHINI_API_KEY: process.env.BHASHINI_API_KEY,
    BHASHINI_USER_ID: process.env.BHASHINI_USER_ID,
    TWOFACTOR_API_KEY: process.env.TWOFACTOR_API_KEY,
  });
  
  if (!serverEnv.success) {
    console.error('Missing required SERVER environment variables:', serverEnv.error.format());
    throw new Error('Missing server environment variables');
  }
  
  return {
    ...config,
    ...serverEnv.data
  };
}
