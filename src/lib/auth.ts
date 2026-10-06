import { parsePhoneNumberWithError } from 'libphonenumber-js';
import { getServiceSupabase } from './supabase';

export async function checkRateLimitAsync(identifier: string, limit: number, windowMs: number): Promise<boolean> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_key: identifier,
    p_max_points: limit,
    p_window_ms: windowMs
  });
  
  if (error) {
    console.error('Rate limit RPC error:', error);
    // On DB failure, degrade gracefully - allow request but log
    return true; 
  }
  
  return data === true;
}

export function normalizePhoneNumber(phone: string): string {
  try {
    const phoneNumber = parsePhoneNumberWithError(phone, 'IN');
    if (!phoneNumber.isValid() || phoneNumber.country !== 'IN') {
      throw new Error('Invalid Indian mobile number');
    }
    const nationalNumber = phoneNumber.nationalNumber;
    // Ensure it starts with 6-9 and is exactly 10 digits
    if (!/^[6-9]\d{9}$/.test(nationalNumber)) {
       throw new Error('Number must be a valid 10-digit Indian mobile number');
    }
    return phoneNumber.format('E.164');
  } catch (err) {
    throw new Error('Invalid phone number format');
  }
}
