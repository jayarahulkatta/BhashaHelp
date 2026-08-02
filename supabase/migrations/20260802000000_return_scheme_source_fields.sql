create extension if not exists pgcrypto;

create or replace function match_schemes (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  name text,
  description text,
  eligibility_criteria text,
  benefits text,
  application_process text,
  source_url text,
  last_verified_date date,
  similarity float
)
language sql stable
as $$
  select
    id,
    name,
    description,
    eligibility_criteria,
    benefits,
    application_process,
    source_url,
    last_verified_date,
    1 - (schemes.embedding <=> query_embedding) as similarity
  from schemes
  where is_active = true and 1 - (schemes.embedding <=> query_embedding) > match_threshold
  order by schemes.embedding <=> query_embedding
  limit match_count;
$$;
