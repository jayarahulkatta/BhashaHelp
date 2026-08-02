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

drop policy if exists "Users can read their own role" on user_roles;
create policy "Users can read their own role" on user_roles for select using ((select auth.uid()) = id);

drop policy if exists "Users can read own preferences" on user_preferences;
drop policy if exists "Users can update own preferences" on user_preferences;
drop policy if exists "Users can insert own preferences" on user_preferences;
create policy "Users can read own preferences" on user_preferences for select using ((select auth.uid()) = id);
create policy "Users can update own preferences" on user_preferences for update using ((select auth.uid()) = id);
create policy "Users can insert own preferences" on user_preferences for insert with check ((select auth.uid()) = id);

drop policy if exists "Users can read own queries" on query_history;
drop policy if exists "Users can insert own queries" on query_history;
create policy "Users can read own queries" on query_history for select using ((select auth.uid()) = user_id);
create policy "Users can insert own queries" on query_history for insert with check ((select auth.uid()) = user_id);

create index if not exists query_history_user_id_idx on query_history (user_id);
create index if not exists scheme_audit_log_scheme_id_idx on scheme_audit_log (scheme_id);
create index if not exists scheme_audit_log_changed_by_idx on scheme_audit_log (changed_by);

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
