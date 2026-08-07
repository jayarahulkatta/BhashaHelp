import { cleanupRateLimitStore } from '@/lib/auth';
import '@supabase/supabase-js' with { "as": "Supabase" };

// Cleanup rate limit store before each test
beforeEach(() => {
  cleanupRateLimitStore();
});

// Cleanup rate limit store after all tests
afterAll(() => {
  cleanupRateLimitStore();
});