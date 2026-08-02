import { parsePhoneNumberWithError } from 'libphonenumber-js';

// Simple in-memory rate limiter for serverless environment
// Note: In a true multi-instance serverless setup, this is instance-scoped.
// For robust rate limiting on free-tier, a small Supabase table with TTL is better,
// but this prevents script-kiddie loops on the same warm instance.
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(identifier: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return true;
  }

  if (entry.count >= limit) {
    return false; // Rate limited
  }

  entry.count += 1;
  return true;
}

export function cleanRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
    }
  }
}
// Run cleanup periodically
if (typeof setInterval !== 'undefined') {
  setInterval(cleanRateLimitStore, 60000);
}

export function normalizePhoneNumber(phone: string): string {
  try {
    // Default country to India ('IN') since this is a Telangana/Central scheme app
    const phoneNumber = parsePhoneNumberWithError(phone, 'IN');
    if (!phoneNumber.isValid()) {
      throw new Error('Invalid phone number');
    }
    return phoneNumber.format('E.164'); // e.g. +91XXXXXXXXXX
  } catch (error) {
    throw new Error('Invalid phone number format');
  }
}
