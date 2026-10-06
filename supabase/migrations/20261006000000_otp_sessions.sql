CREATE TABLE IF NOT EXISTS public.otp_sessions (
    session_id text PRIMARY KEY,
    phone text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.otp_sessions ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role can manage otp_sessions" ON public.otp_sessions
    FOR ALL
    USING (auth.role() = 'service_role');
