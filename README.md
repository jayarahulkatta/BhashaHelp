# BhashaHelp

BhashaHelp is a mobile-first voice assistant for discovering verified Indian government welfare schemes in Telugu, Hindi, and English. It uses Supabase for auth/data, Gemini for embeddings and grounded answers, 2Factor for OTP login, and Bhashini for text-to-speech.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and fill in the real values:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
BHASHINI_API_KEY=
BHASHINI_USER_ID=
TWOFACTOR_API_KEY=
```

3. In Supabase, run the schema in `supabase/schema.sql`. If the database already exists, apply the migration in `supabase/migrations/20260802000000_return_scheme_source_fields.sql`.

4. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Supabase Requirements

- Enable `vector` and `pgcrypto` extensions.
- Create the `schemes`, `user_preferences`, `query_logs`, `user_roles`, and `scheme_audit_log` tables from `supabase/schema.sql`.
- Confirm RLS is enabled on every table.
- Confirm `match_schemes` returns `source_url` and `last_verified_date`, because the UI and answer prompt use both fields.

## Verification

Run these before deploying:

```bash
npm run lint
npm run build
npm audit --audit-level=high
```

The project currently uses npm overrides for `postcss` and `sharp` so dependency audits stay clean while staying on the current Next.js release.
