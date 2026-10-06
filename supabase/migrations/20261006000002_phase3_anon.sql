-- Allow null user_id in query_logs
ALTER TABLE public.query_logs ALTER COLUMN user_id DROP NOT NULL;

-- Fix match_eligible_schemes_semantic for anonymous users (when p_user_id is null)
CREATE OR REPLACE FUNCTION public.match_eligible_schemes_semantic(
    p_user_id uuid,
    p_query_embedding vector(768),
    p_threshold double precision,
    p_limit integer default 5
)
RETURNS TABLE (scheme_id uuid, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, 1 - (s.content_embedding <=> p_query_embedding)
  FROM public.schemes s
  WHERE s.is_active
    AND (
        p_user_id IS NULL 
        OR 
        s.id IN (SELECT ms.scheme_id FROM public.match_schemes(p_user_id) ms)
    )
    AND s.content_embedding IS NOT NULL
    AND 1 - (s.content_embedding <=> p_query_embedding) >= p_threshold
  ORDER BY s.content_embedding <=> p_query_embedding
  LIMIT p_limit;
$$;
