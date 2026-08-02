import { NextResponse } from 'next/server';
import { checkRateLimit, normalizePhoneNumber } from '@/lib/auth';
import { validateServerConfig } from '@/lib/config';
import { getServiceSupabase } from '@/lib/supabase';
import crypto from 'crypto';
import { z } from 'zod';

const verifyOtpSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  otp: z.string().min(4, 'OTP is required'),
  sessionId: z.string().min(1, 'Session ID is required')
});

export async function POST(request: Request) {
  try {
    const config = validateServerConfig();
    const body = await request.json();
    
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    
    const { phone, otp, sessionId } = parsed.data;

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch (e) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // IP-based rate limiting for verification attempts
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    const rateLimitKey = `verify-otp:${ip}:${normalizedPhone}`;
    
    // Max 5 attempts per 5 minutes
    if (!checkRateLimit(rateLimitKey, 5, 5 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many verification attempts. Please try again later.' }, { status: 429 });
    }

    // Call 2Factor.in Verification API
    // 2Factor URL format: https://2factor.in/API/V1/{api_key}/SMS/VERIFY/{session_id}/{otp_entered_by_user}
    const verifyUrl = `https://2factor.in/API/V1/${config.TWOFACTOR_API_KEY}/SMS/VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`;
    
    const response = await fetch(verifyUrl, { method: 'GET' });
    const data = await response.json();

    if (data.Status !== 'Success') {
      return NextResponse.json({ error: 'Invalid OTP' }, { status: 400 });
    }

    // OTP is valid. Now handle Supabase authentication.
    const supabaseAdmin = getServiceSupabase();
    
    // Check if the user already exists in auth.users
    const { data: userRecord, error: userLookupError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('phone', normalizedPhone)
      .schema('auth')
      .maybeSingle();

    if (userLookupError) {
      console.error('Error looking up user:', userLookupError);
      return NextResponse.json({ error: 'Internal server error during authentication' }, { status: 500 });
    }

    // Generate a high-entropy random password just for this login session
    const oneTimePassword = crypto.randomBytes(32).toString('base64');

    if (userRecord) {
      // User exists, update their password so the client can log in
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userRecord.id, {
        password: oneTimePassword,
        phone_confirm: true // Ensure phone is confirmed
      });

      if (updateError) throw updateError;
    } else {
      // Create new user
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: normalizedPhone,
        password: oneTimePassword,
        phone_confirm: true,
      });

      if (createError) throw createError;
    }

    // Return the one-time password to the client.
    // The client will immediately use this to call `supabase.auth.signInWithPassword()`
    // This is secure because the payload is encrypted in transit via HTTPS and immediately discarded.
    return NextResponse.json({ 
      phone: normalizedPhone, 
      password: oneTimePassword 
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
