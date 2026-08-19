-- Give active workspace administrators a privacy-conscious panelist directory.
-- Exact birth data and allergen declarations remain outside this endpoint;
-- administrators receive only the age band and operational readiness metadata.

CREATE FUNCTION public.list_panelist_directory()
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  panelist_id text,
  status text,
  consent_accepted_at timestamptz,
  consent_version text,
  completed_count bigint,
  training_level text,
  phone text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  country text,
  profile_completed_at timestamptz,
  eligibility_completed_at timestamptz,
  age_band text,
  gender text,
  household_size smallint,
  children_in_household boolean,
  dietary_pattern text,
  grocery_role text,
  category_usage_frequency text,
  declaration_confirmed_at timestamptz,
  declaration_expires_at timestamptz,
  research_profile_updated_at timestamptz,
  last_activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    p.id,
    p.name,
    p.email,
    p.panelist_id,
    p.status,
    p.consent_accepted_at,
    p.consent_version,
    (
      (SELECT count(*) FROM public.responses r WHERE r.user_id = p.id)
      + (SELECT count(*) FROM public.concept_responses cr WHERE cr.user_id = p.id)
    )::bigint AS completed_count,
    p.training_level,
    p.phone,
    p.address_line_1,
    p.address_line_2,
    p.city,
    p.region,
    p.postal_code,
    p.country,
    p.profile_completed_at,
    p.eligibility_completed_at,
    CASE
      WHEN e.panelist_id IS NULL THEN NULL
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 25 THEN '18–24'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 35 THEN '25–34'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 45 THEN '35–44'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 55 THEN '45–54'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 65 THEN '55–64'
      ELSE '65+'
    END AS age_band,
    e.gender,
    e.household_size,
    e.children_in_household,
    e.dietary_pattern,
    e.grocery_role,
    e.category_usage_frequency,
    e.declaration_confirmed_at,
    e.declaration_expires_at,
    e.updated_at AS research_profile_updated_at,
    GREATEST(
      (SELECT max(r.created_at) FROM public.responses r WHERE r.user_id = p.id),
      (SELECT max(cr.created_at) FROM public.concept_responses cr WHERE cr.user_id = p.id)
    ) AS last_activity_at
  FROM public.profiles p
  LEFT JOIN public.panelist_eligibility_profiles e
    ON e.panelist_id = p.id AND e.org_id = p.org_id
  WHERE public.is_admin()
    AND p.org_id = public.current_org_id()
    AND p.role = 'panelist'
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_panelist_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_panelist_directory() TO authenticated;

COMMENT ON FUNCTION public.list_panelist_directory() IS
  'Returns administrator-visible panelist operations and research-profile fields without exact birth data or allergen declarations.';
