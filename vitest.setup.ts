// Rate limiting is now DB-based (via Supabase RPC).
// Mock the auth module to always allow requests in tests.
import { vi } from 'vitest';

process.env.TWOFACTOR_API_KEY = 'TEST_API_KEY';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'TEST_DB_KEY';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'TEST_ANON_KEY';

vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>();
  return {
    ...actual,
    checkRateLimitAsync: vi.fn().mockResolvedValue(true),
  };
});