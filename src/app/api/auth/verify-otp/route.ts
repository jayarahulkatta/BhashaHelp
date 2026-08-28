import { NextResponse } from 'next/server';
import { checkRateLimit, normalizePhoneNumber } from '@/lib/auth';
import { getTwoFactorConfig } from '@/lib/config';
import { getServiceSupabase } from '@/lib/supabase';
import crypto from 'crypto';
import { z } from 'zod';

const verifyOtpSchema = z.object({
  phone: z.string().min(1, 'Phone number is required'),
  otp: z.string().min(4, 'OTP is required'),
  sessionId: z.string().min(1, 'Session ID is required')
});

function phoneToAuthEmail(phone: string) {
  const digits = phone.replace(/\D/g, '');
  return `${digits}@phone.bhashahelp.local`;
}

export async function POST(request: Request) {
  try {
    const config = getTwoFactorConfig();
    const body = await request.json();
    
    const parsed = verifyOtpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    
    const { phone, otp, sessionId } = parsed.data;

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhoneNumber(phone);
    } catch {
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
    const verifyUrl = `https://2factor.in/API/V1/${config.apiKey}/SMS/VERIFY/${encodeURIComponent(sessionId)}/${encodeURIComponent(otp)}`;
    
    const response = await fetch(verifyUrl, { method: 'GET' });
    const data = await response.json();

    if (data.Status !== 'Success') {
      return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 400 });
    }

    // OTP is valid. Now handle Supabase authentication.
    const supabaseAdmin = getServiceSupabase();
    const authEmail = phoneToAuthEmail(normalizedPhone);
    
    // Generate a high-entropy random password just for this login session
    const oneTimePassword = crypto.randomBytes(32).toString('base64');

    let userId: string;

    try {
      // Find the user by paginating through listUsers (since getUserByEmail doesn't exist on the JS client)
      let existingUser = null;
      let page = 1;
      while (true) {
        const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
        if (listError) throw listError;
        if (!listData.users || listData.users.length === 0) break;
        
        const found = listData.users.find((u: any) => u.email === authEmail);
        if (found) {
          existingUser = { user: found };
          break;
        }
        page++;
      }

      if (existingUser?.user) {
        // User exists — update their password for this session
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.user.id, {
          password: oneTimePassword,
          user_metadata: {
            ...existingUser.user.user_metadata,
            phone: normalizedPhone,
          }
        });
        if (updateError) throw updateError;
        userId = existingUser.user.id;
      } else {
        // New user — create them
        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: authEmail,
          password: oneTimePassword,
          email_confirm: true,
          user_metadata: { phone: normalizedPhone },
        });
        if (createError) throw createError;
        userId = newUser.user.id;
      }
    } catch (userError) {
      console.error('Error managing user account:', userError);
      return NextResponse.json({ error: 'Internal server error during authentication' }, { status: 500 });
    }

    // Return the one-time credentials to the client.
    // The client immediately uses this to call `supabase.auth.signInWithPassword()`.
    // This is secure: payload is encrypted in transit via HTTPS and discarded immediately.
    return NextResponse.json({ 
      email: authEmail,
      phone: normalizedPhone,
      password: oneTimePassword,
      userId
    });

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
