# BhashaHelp — Project Context for Agents

## Purpose
Voice-first web app helping low-literacy Indian users discover government welfare schemes in Telugu, Hindi, or English.

## Tech Stack
- **Framework**: Next.js 15 (App Router, TypeScript, React 19)
- **Database**: Supabase (PostgreSQL + pgvector for RAG embeddings)
- **AI**: Gemini (embeddings + generation), Sarvam AI / Bhashini (speech)
- **Auth**: Phone OTP via 2Factor.in + Supabase
- **UI**: Tailwind CSS 4, shadcn/ui, Lucide icons

## Scheme Data Source (Immutable)
| Source | Role |
|--------|------|
| **MyScheme.gov.in** | Primary: official GoI scheme portal |
| **data.gov.in** | Supplementary open datasets |
| **Manual curation** | You/your team read pages → structure into Supabase tables |
| **Storage** | `schemes` table with pgvector embeddings for RAG |

**No automated scraping** — all data is human-curated and verified.

## Key Architecture

### Speech Provider Abstraction (`src/lib/speech/`)
- `SpeechProvider` interface: `transcribe()`, `translate()`, `synthesize()`
- `SarvamSpeechProvider` — primary (free credits, instant signup)
- `BhashiniSpeechProvider` — stub, ready for govt API approval
- Factory: `getSpeechProvider()` reads `SPEECH_PROVIDER=sarvam|bhashini`
- **Server-only** — API keys never exposed to client

### RAG Query Flow (`/api/query`)
1. Receive voice/text query in hi/te/en
2. Translate to English (Gemini) if needed
3. Embed query (Gemini) → vector search `match_schemes` RPC
4. Construct context from top-k schemes
5. Generate answer (Gemini) with strict anti-hallucination prompt
6. Log to `query_logs`

### Voice Interface (`VoiceInterface.tsx`)
- Browser Web Speech API for STT (client-side, temporary)
- TTS via `/api/tts` → returns base64 audio → plays in `<audio>`
- States: idle → recording → confirming → searching → result

## Key Files
```
src/
├── app/api/
│   ├── query/route.ts      # RAG search + answer generation
│   ├── tts/route.ts        # TTS (currently Bhashini, migrating to provider)
│   └── auth/               # OTP send/verify
├── lib/
│   ├── speech/             # NEW: provider abstraction (provider.ts, sarvam.ts, bhashini.ts, index.ts)
│   ├── gemini.ts           # Embeddings + generation
│   ├── config.ts           # Env validation (Zod)
│   ├── supabase.ts         # Server/client clients
│   └── i18n.ts             # hi/te/en translations
├── hooks/useVoice.ts       # Browser STT (will migrate to server STT)
└── components/VoiceInterface.tsx
```

## Environment Variables
| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only) |
| `GEMINI_API_KEY` | Gemini API key |
| `SARVAM_API_KEY` | Sarvam AI speech API |
| `SPEECH_PROVIDER` | `sarvam` or `bhashini` |
| `BHASHINI_API_KEY` / `BHASHINI_USER_ID` | Bhashini (when approved) |
| `TWOFACTOR_API_KEY` | 2Factor.in OTP service |

## Agent Guidelines
- **Never expose API keys** to client code — use server actions / API routes only
- **Scheme data is ground truth** — never hallucinate schemes; RAG retrieval is mandatory
- **Low-literacy UX** — simple language, voice-first, large tap targets, clear confirmations
- **Anti-phishing** — never ask for Aadhaar, bank details, OTPs in chat
- **Provider-agnostic** — all speech code uses `getSpeechProvider()`, not direct vendor calls
