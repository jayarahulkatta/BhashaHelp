-- Historical migration version retained for Supabase ordering. Profile fields belong
-- on the existing one-to-one user_preferences table, not a separate user_profiles table.
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

alter table public.user_preferences add constraint user_preferences_age_check check (age is null or age between 0 and 120);
alter table public.user_preferences add constraint user_preferences_area_check check (area is null or area in ('urban', 'rural'));
alter table public.user_preferences add constraint user_preferences_disability_percentage_check check (disability_percentage is null or disability_percentage between 0 and 100);

create or replace function public.touch_user_preferences_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at = now(); return new; end; $$;
drop trigger if exists user_preferences_updated_at on public.user_preferences;
create trigger user_preferences_updated_at before update on public.user_preferences for each row execute function public.touch_user_preferences_updated_at();

grant select, insert, update on public.user_preferences to authenticated;
grant all on public.user_preferences to service_role;
