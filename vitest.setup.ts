/// <reference types="vitest/globals" />
import { cleanRateLimitStore } from '@/lib/auth';

// Cleanup rate limit store before each test
beforeEach(() => {
  cleanRateLimitStore();
});

// Cleanup rate limit store after all tests
afterAll(() => {
  cleanRateLimitStore();
});