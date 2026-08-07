-- Create user_profiles table for storing demographic information
create table if not exists public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  gender text,
  age integer,
  state text,
  category text, -- General, SC, ST, OBC, etc.
  is_disabled boolean default false,
  is_minority boolean default false,
  is_student boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.user_profiles enable row level security;

-- Create policies
create policy "Users can read own profile" on public.user_profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.user_profiles
  for update using (auth.uid() = id);

create policy "Users can insert own profile" on public.user_profiles
  for insert with check (auth.uid() = id);

-- Trigger to update 'updated_at' column
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.handle_updated_at();

-- Grant access
grant select, insert, update on public.user_profiles to authenticated;
grant all on public.user_profiles to service_role;
