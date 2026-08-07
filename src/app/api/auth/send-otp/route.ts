import { NextResponse } from 'next/server';
import { checkRateLimit, normalizePhoneNumber } from '@/lib/auth';
import { getTwoFactorConfig } from '@/lib/config';
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
    } catch {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // IP-based rate limiting (fallback to a generic key if IP is missing in serverless)
    const ip = request.headers.get('x-forwarded-for') || 'unknown-ip';
    const rateLimitKey = `send-otp:${ip}:${normalizedPhone}`;
    
    // Max 3 requests per 5 minutes
    if (!checkRateLimit(rateLimitKey, 3, 5 * 60 * 1000)) {
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    // Call 2Factor.in API
    const twoFactorUrl = `https://2factor.in/API/V1/${config.apiKey}/SMS/${encodeURIComponent(normalizedPhone)}/AUTOGEN`;
    
    const response = await fetch(twoFactorUrl, { method: 'GET' });
    const data = await response.json();

    if (data.Status !== 'Success') {
      console.error('2Factor API Error:', data);
      return NextResponse.json({ error: 'Failed to send OTP' }, { status: 500 });
    }

    // Return the session ID required for verification
    return NextResponse.json({ sessionId: data.Details, phone: normalizedPhone });

  } catch (error) {
    console.error('Send OTP Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
