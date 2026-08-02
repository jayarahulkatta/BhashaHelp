-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;
create extension if not exists pgcrypto;

-- 1. User Roles (for identifying admins)
create table user_roles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null check (role in ('user', 'admin')) default 'user',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table user_roles enable row level security;
create policy "Users can read their own role" on user_roles for select using ((select auth.uid()) = id);

-- Function to check if current user is an admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- 2. User Preferences
create table user_preferences (
  id uuid references auth.users(id) on delete cascade primary key,
  preferred_language text not null check (preferred_language in ('en', 'te', 'hi')) default 'te',
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table user_preferences enable row level security;
create policy "Users can read own preferences" on user_preferences for select using ((select auth.uid()) = id);
create policy "Users can update own preferences" on user_preferences for update using ((select auth.uid()) = id);
create policy "Users can insert own preferences" on user_preferences for insert with check ((select auth.uid()) = id);

-- 3. Schemes
create table schemes (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- Stores English name (translations handled via UI/LLM or additional columns if needed)
  description text not null,
  eligibility_criteria text not null,
  benefits text not null,
  application_process text not null,
  source_url text,
  last_verified_date date not null,
  is_active boolean default true not null,
  embedding vector(768), -- For Gemini's gemini-embedding-001 (scaled to 768)
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
-- Create HNSW index for fast nearest-neighbor search
create index on schemes using hnsw (embedding vector_cosine_ops);

alter table schemes enable row level security;
create policy "Anyone can read active schemes" on schemes for select using (is_active = true or is_admin());
create policy "Only admins can insert schemes" on schemes for insert with check (is_admin());
create policy "Only admins can update schemes" on schemes for update using (is_admin());
create policy "Only admins can delete schemes" on schemes for delete using (is_admin());

-- Vector Similarity Search Function
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
set search_path = public
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

-- 4. Query History
create table query_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  query_text text not null,
  language text not null,
  response_text text not null,
  schemes_retrieved jsonb, -- Array of scheme IDs and their similarity scores
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index query_history_user_id_idx on query_history (user_id);
alter table query_history enable row level security;
create policy "Users can read own queries" on query_history for select using ((select auth.uid()) = user_id);
create policy "Users can insert own queries" on query_history for insert with check ((select auth.uid()) = user_id);
-- No update or delete policies for query history to maintain an immutable log for the user.

-- 5. Scheme Audit Log
create table scheme_audit_log (
  id uuid primary key default gen_random_uuid(),
  scheme_id uuid references schemes(id) on delete set null, -- Don't cascade so we keep history if scheme is deleted
  changed_by uuid references auth.users(id) on delete set null,
  change_type text not null check (change_type in ('INSERT', 'UPDATE', 'DELETE')),
  old_values jsonb,
  new_values jsonb,
  changed_at timestamp with time zone default timezone('utc'::text, now()) not null
);
create index scheme_audit_log_scheme_id_idx on scheme_audit_log (scheme_id);
create index scheme_audit_log_changed_by_idx on scheme_audit_log (changed_by);
alter table scheme_audit_log enable row level security;
create policy "Only admins can read audit logs" on scheme_audit_log for select using (is_admin());
-- Insert is strictly handled via trigger.

-- Trigger function for audit logging
create or replace function log_scheme_changes()
returns trigger as $$
begin
  if (TG_OP = 'DELETE') then
    insert into scheme_audit_log (scheme_id, changed_by, change_type, old_values)
    values (OLD.id, auth.uid(), 'DELETE', row_to_json(OLD));
    return OLD;
  elsif (TG_OP = 'UPDATE') then
    insert into scheme_audit_log (scheme_id, changed_by, change_type, old_values, new_values)
    values (NEW.id, auth.uid(), 'UPDATE', row_to_json(OLD), row_to_json(NEW));
    return NEW;
  elsif (TG_OP = 'INSERT') then
    insert into scheme_audit_log (scheme_id, changed_by, change_type, new_values)
    values (NEW.id, auth.uid(), 'INSERT', row_to_json(NEW));
    return NEW;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function public.log_scheme_changes() from public, anon, authenticated;

create trigger schemes_audit_trigger
after insert or update or delete on schemes
for each row execute function log_scheme_changes();
