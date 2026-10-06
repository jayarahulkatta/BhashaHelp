/// <reference types="vitest/globals" />

// Rate limiting is now DB-based (via Supabase RPC), so no in-memory cleanup needed.
// Tests that exercise rate limiting should mock @/lib/auth instead.