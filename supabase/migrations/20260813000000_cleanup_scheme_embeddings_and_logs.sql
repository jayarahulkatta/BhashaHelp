-- Remove legacy columns/tables now that the backend writes to content_embedding
-- and query_logs.

drop index if exists public.schemes_embedding_idx;
drop index if exists schemes_embedding_idx;
alter table if exists public.schemes drop column if exists embedding;

do $$
begin
  if to_regclass('public.query_history') is not null then
    insert into public.query_logs (
      user_id,
      query_text_raw,
      query_language,
      retrieved_scheme_ids,
      top_similarity_score,
      confidence_flag,
      response_text,
      created_at
    )
    select
      user_id,
      query_text,
      case when language in ('en', 'hi', 'te') then language else 'en' end,
      coalesce(
        array(
          select value::uuid
          from jsonb_array_elements_text(
            case
              when jsonb_typeof(schemes_retrieved) = 'array' then schemes_retrieved
              else '[]'::jsonb
            end
          ) as value
          where value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        ),
        array[]::uuid[]
      ),
      null,
      'confident',
      response_text,
      created_at
    from public.query_history;
  end if;
end $$;

drop table if exists public.query_history;

delete from public.user_preferences
where id is null;
