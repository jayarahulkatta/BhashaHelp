-- Optional profile details improve matching for occupation and household schemes.
alter table public.user_preferences
  add column if not exists occupation text,
  add column if not exists annual_income text,
  add column if not exists is_farmer boolean not null default false,
  add column if not exists marital_status text,
  add column if not exists owns_home boolean not null default false;

create or replace function public.match_schemes(p_user_id uuid)
returns table (scheme_id uuid, match_score integer, matched_reasons text[])
language sql stable security definer set search_path = public as $$
  select s.id, 100, array_remove(array[
    case when s.eligibility_criteria ? 'gender' then 'gender' end,
    case when s.eligibility_criteria ? 'category' then 'category' end,
    case when s.eligibility_criteria ? 'area' then 'area' end,
    case when s.eligibility_criteria ? 'age_min' or s.eligibility_criteria ? 'age_max' then 'age' end,
    case when s.eligibility_criteria ? 'occupation' then 'occupation' end,
    case when s.eligibility_criteria ? 'annual_income' then 'annual_income' end,
    case when coalesce((s.eligibility_criteria->>'farmer_required')::boolean, false) then 'farmer' end
  ], null)
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
    and (not coalesce((s.eligibility_criteria->>'farmer_required')::boolean, false) or p.is_farmer)
    and (not (s.eligibility_criteria ? 'occupation') or lower(coalesce(p.occupation, '')) = any (select lower(value) from jsonb_array_elements_text(s.eligibility_criteria->'occupation') value))
    and (not (s.eligibility_criteria ? 'annual_income') or p.annual_income = any (select value from jsonb_array_elements_text(s.eligibility_criteria->'annual_income') value))
    and (not (s.eligibility_criteria ? 'marital_status') or lower(coalesce(p.marital_status, '')) = any (select lower(value) from jsonb_array_elements_text(s.eligibility_criteria->'marital_status') value))
    and (not coalesce((s.eligibility_criteria->>'owns_home_required')::boolean, false) or p.owns_home)
  order by s.name_en;
$$;
