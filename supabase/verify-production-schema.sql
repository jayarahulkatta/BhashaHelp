-- Read-only post-migration verification. Run in the Supabase SQL editor.
select table_name, column_name, data_type, udt_name, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('schemes', 'user_preferences', 'user_roles', 'scheme_translations', 'query_logs', 'query_history', 'scheme_audit_log')
order by table_name, ordinal_position;

select table_name, policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('schemes', 'user_preferences', 'user_roles', 'scheme_translations', 'query_logs', 'query_history', 'scheme_audit_log')
order by tablename, policyname;
