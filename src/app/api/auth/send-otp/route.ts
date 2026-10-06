import { NextResponse } from 'next/server';
import { checkRateLimitAsync, normalizePhoneNumber } from '@/lib/auth';
import { getTwoFactorConfig } from '@/lib/config';
import { getServiceSupabase } from '@/lib/supabase';
import { z } from 'zod';

const sendOtpSchema = z.object({
  phone: z.string().min(1, 'Phone number is required')
});

export async function POST(request: Request) {
  try {
    const config = getTwoFactorConfig();
    const body = await request.json();
    
    const parsed = sendOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    
    const { phone } = parsed.data;

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'Invalid phone number format' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    
    // IP-based rate limiting: 20 per hour
    if (!(await checkRateLimitAsync(`send-otp:ip:${ip}`, 20, 60 * 60 * 1000))) {
      return NextResponse.json({ error: 'Too many requests from this IP. Please try again later.' }, { status: 429 });
    }

    // Phone-based cooldown: max 1 per 60s
    if (!(await checkRateLimitAsync(`send-otp:cooldown:${normalizedPhone}`, 1, 60 * 1000))) {
      return NextResponse.json({ error: 'Please wait 60 seconds before requesting another OTP.' }, { status: 429 });
    }

    // Phone-based limit: max 3 per 15 minutes
    if (!(await checkRateLimitAsync(`send-otp:phone:${normalizedPhone}`, 3, 15 * 60 * 1000))) {
      return NextResponse.json({ error: 'Too many requests for this phone number. Please try again later.' }, { status: 429 });
    }

    // Phone-based daily limit: 10 per day
    if (!(await checkRateLimitAsync(`send-otp:daily:${normalizedPhone}`, 10, 24 * 60 * 60 * 1000))) {
      return NextResponse.json({ error: 'Daily limit reached for this phone number.' }, { status: 429 });
    }

    // 2Factor.in API handles SMS and VOICE. We can use the TemplateName parameter to enforce SMS
    // or rely on the AUTOGEN endpoint. However, 2Factor falls back to voice automatically if SMS fails.
    // To restrict to SMS only, we should ideally use their transactional endpoints or check if the configuration
    // specifically forces it. For AUTOGEN, if it falls back to Voice, the Status might still be Success
    // but we'll monitor the Details. We can append `?sms_only=1` if the provider supports it, or just use the SMS endpoint.
    let twoFactorUrl = `https://2factor.in/API/V1/${config.apiKey}/SMS/${encodeURIComponent(normalizedPhone)}/AUTOGEN`;
    
    if (config.otpChannel === 'voice') {
      twoFactorUrl = `https://2factor.in/API/V1/${config.apiKey}/VOICE/${encodeURIComponent(normalizedPhone)}/AUTOGEN`;
    }

    const response = await fetch(twoFactorUrl, { method: 'GET' });
    const data = await response.json();

    if (data.Status !== 'Success') {
      console.error(`2Factor API Error on Send: Status=${data.Status}, Details=${data.Details}, Phone=***${normalizedPhone.slice(-4)}`);
      // Return a user-friendly error instead of silently continuing
      return NextResponse.json({ error: 'Failed to send OTP. Please try again later.' }, { status: 500 });
    }

    // Save session binding to database
    const supabase = getServiceSupabase();
    const { error: dbError } = await supabase.from('otp_sessions').insert({
      session_id: data.Details,
      phone: normalizedPhone,
    });

    if (dbError) {
      console.error('Database Error saving OTP session:', dbError);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Return the session ID required for verification
    return NextResponse.json({ sessionId: data.Details, phone: normalizedPhone });

  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
