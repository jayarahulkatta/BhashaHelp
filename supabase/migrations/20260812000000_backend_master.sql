-- BhashaHelp backend upgrade for the production schema as of 2026-08-12.
-- It intentionally extends user_preferences; user_profiles does not exist.
create extension if not exists vector;

-- Rename only columns present in the original MVP table.
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schemes' and column_name = 'name') then
    alter table public.schemes rename column name to name_en;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schemes' and column_name = 'description') then
    alter table public.schemes rename column description to description_en;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'schemes' and column_name = 'benefits') then
    alter table public.schemes rename column benefits to benefits_en;
  end if;
end $$;

alter table public.schemes
  add column if not exists scheme_code text,
  add column if not exists category text not null default 'Benefits & Social Development',
  add column if not exists level text not null default 'state',
  add column if not exists applicable_states text[] not null default array['ALL']::text[],
  add column if not exists official_url text,
  add column if not exists source text not null default 'myscheme',
  add column if not exists last_verified_at date,
  add column if not exists verified_by text not null default 'legacy-import',
  add column if not exists content_embedding vector(768),
  add column if not exists nodal_ministry_or_dept text,
  add column if not exists application_process_en text,
  add column if not exists required_documents text[] not null default array[]::text[];

-- Existing eligibility data is plain text. Preserve it in JSON rather than risking
-- an invalid JSON cast; curators replace legacy_text with structured criteria.
alter table public.schemes alter column eligibility_criteria drop default;
alter table public.schemes alter column eligibility_criteria type jsonb
  using case when eligibility_criteria is null or btrim(eligibility_criteria) = '' then '{}'::jsonb
             else jsonb_build_object('legacy_text', eligibility_criteria) end;
alter table public.schemes alter column eligibility_criteria set default '{}'::jsonb;

update public.schemes set
  scheme_code = coalesce(scheme_code, 'LEGACY-' || id::text),
  official_url = coalesce(official_url, 'https://www.myscheme.gov.in'),
  last_verified_at = coalesce(last_verified_at, current_date),
  application_process_en = coalesce(application_process_en, 'See the official scheme portal for the application process.')
where scheme_code is null or official_url is null or last_verified_at is null or application_process_en is null;
alter table public.schemes alter column scheme_code set not null;
alter table public.schemes alter column official_url set not null;
alter table public.schemes alter column last_verified_at set not null;
alter table public.schemes alter column application_process_en set not null;
alter table public.schemes add constraint schemes_scheme_code_key unique (scheme_code);
alter table public.schemes add constraint schemes_level_check check (level in ('central', 'state'));
alter table public.schemes add constraint schemes_source_check check (source in ('myscheme', 'data.gov.in', 'india.gov.in', 'official'));

-- The existing preferences row is the user's one-to-one profile record.
alter table public.user_preferences
  add column if not exists gender text,
  add column if not exists age integer,
  add column if not exists state text not null default 'Telangana',
  add column if not exists area text,
  add column if not exists category text,
  add column if not exists has_disability boolean not null default false,
  add column if not exists disability_percentage integer,
  add column if not exists is_minority boolean not null default false,
  add column if not exists is_student boolean not null default false,
  add column if not exists profile_completed_at timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_age_check' and conrelid = 'public.user_preferences'::regclass) then
    alter table public.user_preferences add constraint user_preferences_age_check check (age is null or age between 0 and 120);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_area_check' and conrelid = 'public.user_preferences'::regclass) then
    alter table public.user_preferences add constraint user_preferences_area_check check (area is null or area in ('urban', 'rural'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'user_preferences_disability_percentage_check' and conrelid = 'public.user_preferences'::regclass) then
    alter table public.user_preferences add constraint user_preferences_disability_percentage_check check (disability_percentage is null or disability_percentage between 0 and 100);
  end if;
end $$;
create or replace function public.touch_user_preferences_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.touch_user_preferences_updated_at();

create table if not exists public.scheme_translations (
  id uuid primary key default gen_random_uuid(), scheme_id uuid not null references public.schemes(id) on delete cascade,
  language_code text not null check (language_code in ('en', 'hi', 'te')), name text not null, description text not null,
  benefits text not null, eligibility_summary text not null, needs_review boolean not null default false, unique (scheme_id, language_code)
);
create table if not exists public.query_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, query_text_raw text,
  query_language text check (query_language in ('en', 'hi', 'te')), retrieved_scheme_ids uuid[] not null default array[]::uuid[],
  top_similarity_score numeric, confidence_flag text not null check (confidence_flag in ('confident', 'low_confidence', 'no_match')),
  response_text text, created_at timestamptz not null default now()
);

create index if not exists schemes_category_idx on public.schemes (category) where is_active;
create index if not exists schemes_states_gin_idx on public.schemes using gin (applicable_states);
create index if not exists schemes_eligibility_gin_idx on public.schemes using gin (eligibility_criteria);
create index if not exists schemes_content_embedding_idx on public.schemes using hnsw (content_embedding vector_cosine_ops);
create index if not exists query_logs_confidence_idx on public.query_logs (confidence_flag, created_at desc);
alter table public.scheme_translations enable row level security;
alter table public.query_logs enable row level security;
create policy "public read translations" on public.scheme_translations for select using (true);
create policy "users read own query logs" on public.query_logs for select using (auth.uid() = user_id);
create policy "users insert own query logs" on public.query_logs for insert with check (auth.uid() = user_id);
grant select on public.schemes, public.scheme_translations to anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, insert on public.query_logs to authenticated;
grant all on public.schemes, public.scheme_translations, public.query_logs to service_role;

drop function if exists public.match_schemes(vector, float, integer);
create or replace function public.match_schemes(p_user_id uuid)
returns table (scheme_id uuid, match_score integer, matched_reasons text[])
language sql stable security definer set search_path = public as $$
  select s.id, 100, array_remove(array[
    case when s.eligibility_criteria ? 'gender' then 'gender' end, case when s.eligibility_criteria ? 'category' then 'category' end,
    case when s.eligibility_criteria ? 'area' then 'area' end, case when s.eligibility_criteria ? 'age_min' or s.eligibility_criteria ? 'age_max' then 'age' end], null)
  from public.schemes s join public.user_preferences p on p.id = p_user_id
  where s.is_active and s.applicable_states && array['ALL', p.state]
    and (not (s.eligibility_criteria ? 'age_min') or p.age >= (s.eligibility_criteria->>'age_min')::integer)
    and (not (s.eligibility_criteria ? 'age_max') or p.age <= (s.eligibility_criteria->>'age_max')::integer)
    and (not (s.eligibility_criteria ? 'gender') or lower(coalesce(p.gender, '')) = any (select lower(value) from jsonb_array_elements_text(s.eligibility_criteria->'gender') value))
    and (not (s.eligibility_criteria ? 'category') or p.category = any (select value from jsonb_array_elements_text(s.eligibility_criteria->'category') value))
    and (not (s.eligibility_criteria ? 'area') or p.area = any (select value from jsonb_array_elements_text(s.eligibility_criteria->'area') value))
    and (not coalesce((s.eligibility_criteria->>'disability_required')::boolean, false) or p.has_disability)
    and (not coalesce((s.eligibility_criteria->>'minority_required')::boolean, false) or p.is_minority)
    and (not coalesce((s.eligibility_criteria->>'student_required')::boolean, false) or p.is_student)
  order by s.name_en;
$$;
create or replace function public.match_eligible_schemes_semantic(p_user_id uuid, p_query_embedding vector(768), p_threshold double precision, p_limit integer default 5)
returns table (scheme_id uuid, similarity double precision) language sql stable security definer set search_path = public as $$
  select s.id, 1 - (s.content_embedding <=> p_query_embedding) from public.schemes s
  where s.id in (select scheme_id from public.match_schemes(p_user_id)) and s.content_embedding is not null
    and 1 - (s.content_embedding <=> p_query_embedding) >= p_threshold order by s.content_embedding <=> p_query_embedding limit p_limit;
$$;
grant execute on function public.match_schemes(uuid), public.match_eligible_schemes_semantic(uuid, vector, double precision, integer) to service_role;

-- The API validates the complete payload before calling this function. A function call
-- is one database transaction, so no part of an invalid seed batch is persisted.
create or replace function public.import_schemes_batch(p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare row_data jsonb; translation_data jsonb; scheme_uuid uuid;
begin
  for row_data in select value from jsonb_array_elements(p_rows) loop
    insert into public.schemes (scheme_code, name_en, category, level, nodal_ministry_or_dept, applicable_states, description_en, benefits_en, application_process_en, required_documents, official_url, source, eligibility_criteria, content_embedding, is_active, last_verified_at, verified_by)
    values (row_data->>'scheme_code', row_data->>'name_en', row_data->>'category', row_data->>'level', row_data->>'nodal_ministry_or_dept',
      array(select jsonb_array_elements_text(row_data->'applicable_states')), row_data->>'description_en', row_data->>'benefits_en', row_data->>'application_process_en',
      coalesce(array(select jsonb_array_elements_text(row_data->'required_documents')), array[]::text[]), row_data->>'official_url', row_data->>'source',
      coalesce(row_data->'eligibility_criteria', '{}'::jsonb), nullif(row_data->>'content_embedding', '')::vector,
      coalesce((row_data->>'is_active')::boolean, true), (row_data->>'last_verified_at')::date, row_data->>'verified_by')
    on conflict (scheme_code) do update set name_en = excluded.name_en, category = excluded.category, level = excluded.level,
      nodal_ministry_or_dept = excluded.nodal_ministry_or_dept, applicable_states = excluded.applicable_states, description_en = excluded.description_en,
      benefits_en = excluded.benefits_en, application_process_en = excluded.application_process_en, required_documents = excluded.required_documents,
      official_url = excluded.official_url, source = excluded.source, eligibility_criteria = excluded.eligibility_criteria,
      content_embedding = excluded.content_embedding, is_active = excluded.is_active, last_verified_at = excluded.last_verified_at, verified_by = excluded.verified_by, updated_at = now()
    returning id into scheme_uuid;
    for translation_data in select value from jsonb_array_elements(row_data->'translations') loop
      insert into public.scheme_translations (scheme_id, language_code, name, description, benefits, eligibility_summary, needs_review)
      values (scheme_uuid, translation_data->>'language_code', translation_data->>'name', translation_data->>'description', translation_data->>'benefits', translation_data->>'eligibility_summary', coalesce((translation_data->>'needs_review')::boolean, false))
      on conflict (scheme_id, language_code) do update set name = excluded.name, description = excluded.description, benefits = excluded.benefits, eligibility_summary = excluded.eligibility_summary, needs_review = excluded.needs_review;
    end loop;
  end loop;
end;
$$;
grant execute on function public.import_schemes_batch(jsonb) to service_role;
