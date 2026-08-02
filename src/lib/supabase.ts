import { createClient } from '@supabase/supabase-js';
import { config } from './config';

// For client-side usage (uses anon key, respects RLS)
export const supabase = config.NEXT_PUBLIC_SUPABASE_URL && config.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ? createClient(config.NEXT_PUBLIC_SUPABASE_URL, config.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  : null;

// For server-side usage ONLY (bypasses RLS - use carefully)
export function getServiceSupabase() {
  if (typeof window !== 'undefined') {
    throw new Error('getServiceSupabase can only be called on the server');
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing');
  }

  if (!config.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is missing');
  }

  return createClient(
    config.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
