grant usage on schema public to anon, authenticated, service_role;
grant select on public.schemes to anon, authenticated;
grant select, insert, update on public.user_preferences to authenticated;
grant select, insert on public.query_history to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.scheme_audit_log to authenticated;
grant all on all tables in schema public to service_role;
grant execute on function public.match_schemes(vector, float, int) to service_role;
