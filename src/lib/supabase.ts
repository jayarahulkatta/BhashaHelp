import { createClient } from '@supabase/supabase-js';
import { getOptionalPublicSupabaseConfig, getServiceSupabaseConfig } from './config';

// For client-side usage (uses anon key, respects RLS)
const publicConfig = getOptionalPublicSupabaseConfig();

export const supabase = publicConfig
  ? createClient(publicConfig.url, publicConfig.anonKey)
  : null;

// For server-side usage ONLY (bypasses RLS - use carefully)
export function getServiceSupabase() {
  if (typeof window !== 'undefined') {
    throw new Error('getServiceSupabase can only be called on the server');
  }

  const serviceConfig = getServiceSupabaseConfig();

  return createClient(
    serviceConfig.url,
    serviceConfig.serviceRoleKey
  );
}
