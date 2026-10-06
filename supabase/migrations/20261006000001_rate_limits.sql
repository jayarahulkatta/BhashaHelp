CREATE TABLE IF NOT EXISTS public.rate_limits (
    key text PRIMARY KEY,
    points integer NOT NULL DEFAULT 1,
    expires_at timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS rate_limits_expires_at_idx ON public.rate_limits (expires_at);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage rate_limits" ON public.rate_limits
    FOR ALL
    USING (auth.role() = 'service_role');

-- RPC to atomically check and consume rate limits
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key text,
    p_max_points integer,
    p_window_ms bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_points integer;
    v_expires_at timestamp with time zone;
BEGIN
    -- Delete expired records to keep table small
    DELETE FROM public.rate_limits WHERE expires_at < now();

    -- Try to find the existing limit
    SELECT points, expires_at INTO v_points, v_expires_at
    FROM public.rate_limits
    WHERE key = p_key
    FOR UPDATE;

    IF FOUND THEN
        IF v_points >= p_max_points THEN
            RETURN false;
        END IF;

        UPDATE public.rate_limits
        SET points = points + 1
        WHERE key = p_key;
        
        RETURN true;
    ELSE
        INSERT INTO public.rate_limits (key, points, expires_at)
        VALUES (p_key, 1, now() + (p_window_ms || ' milliseconds')::interval);
        
        RETURN true;
    END IF;
END;
$$;
