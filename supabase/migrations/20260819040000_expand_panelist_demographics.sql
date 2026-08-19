-- Expand the panelist research profile with the controlled demographic fields
-- used for recruitment and response segmentation. Age remains derived from the
-- existing birth month/year so it never becomes stale.

ALTER TABLE public.panelist_eligibility_profiles
  ADD COLUMN gender_self_description text,
  ADD COLUMN nationality_code text,
  ADD COLUMN ethnicity text,
  ADD COLUMN dietary_other text,
  ADD COLUMN smoker_status text,
  ADD COLUMN weekly_food_spend text,
  ADD COLUMN household_size_prefer_not_to_say boolean NOT NULL DEFAULT false,
  ADD COLUMN occupation_group text,
  ADD COLUMN annual_income_range text;

UPDATE public.panelist_eligibility_profiles SET gender = 'female' WHERE gender = 'woman';
UPDATE public.panelist_eligibility_profiles SET gender = 'male' WHERE gender = 'man';
UPDATE public.panelist_eligibility_profiles SET dietary_pattern = 'omnivore' WHERE dietary_pattern = 'no_specific_diet';

ALTER TABLE public.panelist_eligibility_profiles
  DROP CONSTRAINT panelist_eligibility_profiles_gender_check,
  DROP CONSTRAINT panelist_eligibility_profiles_dietary_pattern_check,
  ADD CONSTRAINT panelist_eligibility_profiles_gender_check CHECK (
    gender IS NULL OR gender IN ('female', 'male', 'non_binary', 'self_describe', 'prefer_not_to_say')
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_gender_self_description_check CHECK (
    gender <> 'self_describe' OR length(trim(COALESCE(gender_self_description, ''))) >= 2
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_nationality_check CHECK (
    nationality_code IS NULL OR nationality_code ~ '^[A-Z]{2}$' OR nationality_code IN ('other', 'prefer_not_to_say')
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_ethnicity_check CHECK (
    ethnicity IS NULL OR ethnicity IN ('asian', 'black', 'mixed', 'white', 'other', 'prefer_not_to_say')
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_dietary_pattern_check CHECK (
    dietary_pattern IS NULL OR dietary_pattern IN ('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian', 'halal', 'kosher', 'other', 'prefer_not_to_say')
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_dietary_other_check CHECK (
    dietary_pattern <> 'other' OR length(trim(COALESCE(dietary_other, ''))) >= 2
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_smoker_status_check CHECK (
    smoker_status IS NULL OR smoker_status IN ('non_smoker', 'former', 'occasional', 'regular', 'prefer_not_to_say')
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_weekly_food_spend_check CHECK (
    weekly_food_spend IS NULL OR weekly_food_spend IN ('under_20', '20_40', '40_60', '60_80', '80_100', 'over_100', 'prefer_not_to_say')
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_occupation_group_check CHECK (
    occupation_group IS NULL OR occupation_group IN (
      'manager_director', 'professional', 'associate_professional', 'administrative',
      'skilled_trade', 'caring_leisure', 'sales_customer_service', 'machine_operative',
      'elementary', 'student', 'homemaker_carer', 'retired', 'not_employed',
      'prefer_not_to_say'
    )
  ),
  ADD CONSTRAINT panelist_eligibility_profiles_annual_income_range_check CHECK (
    annual_income_range IS NULL OR annual_income_range IN ('under_20k', '20_30k', '30_40k', '40_60k', '60_80k', 'over_80k', 'prefer_not_to_say')
  );

ALTER TABLE public.response_demographic_snapshots
  ADD COLUMN age_years smallint,
  ADD COLUMN gender_self_description text,
  ADD COLUMN nationality_code text,
  ADD COLUMN ethnicity text,
  ADD COLUMN dietary_other text,
  ADD COLUMN smoker_status text,
  ADD COLUMN weekly_food_spend text,
  ADD COLUMN household_size_prefer_not_to_say boolean NOT NULL DEFAULT false,
  ADD COLUMN occupation_group text,
  ADD COLUMN annual_income_range text;

DROP FUNCTION public.complete_panelist_eligibility_profile(text,text,text,text,text,text,text,text,text,text,integer,integer,text[],text[],text,text,integer,boolean,text,text,text);
CREATE FUNCTION public.complete_panelist_eligibility_profile(
  p_name text,
  p_phone text,
  p_address_line_1 text,
  p_address_line_2 text,
  p_city text,
  p_region text,
  p_postal_code text,
  p_country text,
  p_consent_version text,
  p_consent_user_agent text,
  p_birth_month integer,
  p_birth_year integer,
  p_allergen_avoidances text[],
  p_other_avoidances text[],
  p_health_consent_version text,
  p_gender text DEFAULT NULL,
  p_household_size integer DEFAULT NULL,
  p_children_in_household boolean DEFAULT NULL,
  p_dietary_pattern text DEFAULT NULL,
  p_grocery_role text DEFAULT NULL,
  p_category_usage_frequency text DEFAULT NULL,
  p_gender_self_description text DEFAULT NULL,
  p_nationality_code text DEFAULT NULL,
  p_ethnicity text DEFAULT NULL,
  p_dietary_other text DEFAULT NULL,
  p_smoker_status text DEFAULT NULL,
  p_weekly_food_spend text DEFAULT NULL,
  p_household_size_prefer_not_to_say boolean DEFAULT false,
  p_occupation_group text DEFAULT NULL,
  p_annual_income_range text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_avoidances text[];
  v_other text[];
  v_latest_possible_birth_date date;
  v_nationality text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'You must be signed in to complete your profile'; END IF;
  IF length(trim(COALESCE(p_name, ''))) < 2 THEN RAISE EXCEPTION 'Enter your full name'; END IF;
  IF length(trim(COALESCE(p_phone, ''))) < 7 THEN RAISE EXCEPTION 'Enter a valid phone number'; END IF;
  IF length(trim(COALESCE(p_address_line_1, ''))) < 3
     OR length(trim(COALESCE(p_city, ''))) < 2
     OR length(trim(COALESCE(p_postal_code, ''))) < 2
     OR length(trim(COALESCE(p_country, ''))) < 2 THEN
    RAISE EXCEPTION 'Complete the required shipping address fields';
  END IF;
  IF length(trim(COALESCE(p_consent_version, ''))) = 0
     OR length(trim(COALESCE(p_health_consent_version, ''))) = 0 THEN
    RAISE EXCEPTION 'Panelist and health-data consent are required';
  END IF;
  IF p_birth_month IS NULL OR p_birth_year IS NULL
     OR p_birth_month NOT BETWEEN 1 AND 12
     OR p_birth_year NOT BETWEEN extract(year FROM current_date)::integer - 120 AND extract(year FROM current_date)::integer THEN
    RAISE EXCEPTION 'Enter a valid month and year of birth';
  END IF;
  v_latest_possible_birth_date := (make_date(p_birth_year, p_birth_month, 1) + interval '1 month - 1 day')::date;
  IF v_latest_possible_birth_date > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION 'Panel participation is limited to adults aged 18 or over';
  END IF;

  IF p_gender IS NULL OR p_gender NOT IN ('female', 'male', 'non_binary', 'self_describe', 'prefer_not_to_say') THEN RAISE EXCEPTION 'Choose a gender response'; END IF;
  IF p_gender = 'self_describe' AND length(trim(COALESCE(p_gender_self_description, ''))) < 2 THEN RAISE EXCEPTION 'Describe your gender or choose another answer'; END IF;
  IF p_nationality_code IS NULL THEN RAISE EXCEPTION 'Choose a nationality response'; END IF;
  v_nationality := CASE WHEN lower(p_nationality_code) IN ('other', 'prefer_not_to_say') THEN lower(p_nationality_code) ELSE upper(p_nationality_code) END;
  IF v_nationality !~ '^[A-Z]{2}$' AND v_nationality NOT IN ('other', 'prefer_not_to_say') THEN RAISE EXCEPTION 'Choose a valid nationality response'; END IF;
  IF p_ethnicity IS NULL OR p_ethnicity NOT IN ('asian', 'black', 'mixed', 'white', 'other', 'prefer_not_to_say') THEN RAISE EXCEPTION 'Choose an ethnicity response'; END IF;
  IF p_dietary_pattern IS NULL OR p_dietary_pattern NOT IN ('omnivore', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian', 'halal', 'kosher', 'other', 'prefer_not_to_say') THEN RAISE EXCEPTION 'Choose a dietary preference'; END IF;
  IF p_dietary_pattern = 'other' AND length(trim(COALESCE(p_dietary_other, ''))) < 2 THEN RAISE EXCEPTION 'Describe your dietary preference or choose another answer'; END IF;
  IF p_smoker_status IS NULL OR p_smoker_status NOT IN ('non_smoker', 'former', 'occasional', 'regular', 'prefer_not_to_say') THEN RAISE EXCEPTION 'Choose a smoker-status response'; END IF;
  IF p_weekly_food_spend IS NULL OR p_weekly_food_spend NOT IN ('under_20', '20_40', '40_60', '60_80', '80_100', 'over_100', 'prefer_not_to_say') THEN RAISE EXCEPTION 'Choose a weekly food-shop response'; END IF;
  IF NOT COALESCE(p_household_size_prefer_not_to_say, false)
     AND (p_household_size IS NULL OR p_household_size NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'Choose a household-size response';
  END IF;
  IF p_occupation_group IS NULL OR p_occupation_group NOT IN ('manager_director', 'professional', 'associate_professional', 'administrative', 'skilled_trade', 'caring_leisure', 'sales_customer_service', 'machine_operative', 'elementary', 'student', 'homemaker_carer', 'retired', 'not_employed', 'prefer_not_to_say') THEN RAISE EXCEPTION 'Choose an occupation response'; END IF;
  IF p_annual_income_range IS NULL OR p_annual_income_range NOT IN ('under_20k', '20_30k', '30_40k', '40_60k', '60_80k', 'over_80k', 'prefer_not_to_say') THEN RAISE EXCEPTION 'Choose an annual-income response'; END IF;
  IF p_grocery_role IS NULL OR p_category_usage_frequency IS NULL THEN RAISE EXCEPTION 'Complete the required research profile'; END IF;

  SELECT COALESCE(array_agg(DISTINCT lower(trim(value))) FILTER (WHERE trim(value) <> ''), ARRAY[]::text[])
  INTO v_avoidances FROM unnest(COALESCE(p_allergen_avoidances, ARRAY[]::text[])) AS item(value);
  IF NOT v_avoidances <@ ARRAY[
    'celery', 'cereals_containing_gluten', 'crustaceans', 'eggs', 'fish',
    'lupin', 'milk', 'molluscs', 'mustard', 'peanuts', 'sesame',
    'soybeans', 'sulphites', 'tree_nuts'
  ]::text[] THEN RAISE EXCEPTION 'One or more allergen selections are not recognized'; END IF;
  SELECT COALESCE(array_agg(DISTINCT lower(trim(value))) FILTER (WHERE trim(value) <> ''), ARRAY[]::text[])
  INTO v_other FROM unnest(COALESCE(p_other_avoidances, ARRAY[]::text[])) AS item(value);

  SELECT p.org_id INTO v_org_id FROM public.profiles p
  WHERE p.id = v_user_id AND p.role = 'panelist' AND p.status = 'active' FOR UPDATE;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'An active panelist account was not found'; END IF;

  INSERT INTO public.panelist_eligibility_profiles (
    panelist_id, org_id, birth_month, birth_year, adult_confirmed_at,
    allergen_avoidances, other_avoidances, declaration_confirmed_at,
    declaration_expires_at, health_consent_at, health_consent_version,
    gender, gender_self_description, nationality_code, ethnicity,
    household_size, household_size_prefer_not_to_say, children_in_household,
    dietary_pattern, dietary_other, grocery_role, category_usage_frequency,
    smoker_status, weekly_food_spend, occupation_group, annual_income_range, updated_at
  ) VALUES (
    v_user_id, v_org_id, p_birth_month, p_birth_year, now(),
    v_avoidances, v_other, now(), now() + interval '1 year', now(), trim(p_health_consent_version),
    p_gender, CASE WHEN p_gender = 'self_describe' THEN trim(p_gender_self_description) ELSE NULL END,
    v_nationality, p_ethnicity,
    CASE WHEN COALESCE(p_household_size_prefer_not_to_say, false) THEN NULL ELSE p_household_size END,
    COALESCE(p_household_size_prefer_not_to_say, false), p_children_in_household,
    p_dietary_pattern, CASE WHEN p_dietary_pattern = 'other' THEN trim(p_dietary_other) ELSE NULL END,
    p_grocery_role, p_category_usage_frequency, p_smoker_status, p_weekly_food_spend,
    p_occupation_group, p_annual_income_range, now()
  ) ON CONFLICT (panelist_id) DO UPDATE SET
    birth_month = EXCLUDED.birth_month, birth_year = EXCLUDED.birth_year,
    adult_confirmed_at = EXCLUDED.adult_confirmed_at,
    allergen_avoidances = EXCLUDED.allergen_avoidances, other_avoidances = EXCLUDED.other_avoidances,
    declaration_confirmed_at = EXCLUDED.declaration_confirmed_at,
    declaration_expires_at = EXCLUDED.declaration_expires_at,
    health_consent_at = EXCLUDED.health_consent_at,
    health_consent_version = EXCLUDED.health_consent_version,
    gender = EXCLUDED.gender, gender_self_description = EXCLUDED.gender_self_description,
    nationality_code = EXCLUDED.nationality_code, ethnicity = EXCLUDED.ethnicity,
    household_size = EXCLUDED.household_size,
    household_size_prefer_not_to_say = EXCLUDED.household_size_prefer_not_to_say,
    children_in_household = EXCLUDED.children_in_household,
    dietary_pattern = EXCLUDED.dietary_pattern, dietary_other = EXCLUDED.dietary_other,
    grocery_role = EXCLUDED.grocery_role,
    category_usage_frequency = EXCLUDED.category_usage_frequency,
    smoker_status = EXCLUDED.smoker_status, weekly_food_spend = EXCLUDED.weekly_food_spend,
    occupation_group = EXCLUDED.occupation_group, annual_income_range = EXCLUDED.annual_income_range,
    updated_at = now();

  UPDATE public.profiles p SET
    name = trim(p_name), phone = trim(p_phone), address_line_1 = trim(p_address_line_1),
    address_line_2 = NULLIF(trim(COALESCE(p_address_line_2, '')), ''), city = trim(p_city),
    region = NULLIF(trim(COALESCE(p_region, '')), ''), postal_code = trim(p_postal_code),
    country = trim(p_country), consent_accepted_at = now(), consent_version = trim(p_consent_version),
    consent_user_agent = NULLIF(trim(COALESCE(p_consent_user_agent, '')), ''),
    profile_completed_at = COALESCE(p.profile_completed_at, now()), eligibility_completed_at = now()
  WHERE p.id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_panelist_eligibility_profile(text,text,text,text,text,text,text,text,text,text,integer,integer,text[],text[],text,text,integer,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_panelist_eligibility_profile(text,text,text,text,text,text,text,text,text,text,integer,integer,text[],text[],text,text,integer,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION private.assert_panelist_research_profile_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_ready boolean;
BEGIN
  IF NEW.role <> 'panelist' OR NEW.eligibility_completed_at IS NULL THEN RETURN NEW; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.panelist_eligibility_profiles e
    WHERE e.panelist_id = NEW.id AND e.org_id = NEW.org_id
      AND e.gender IS NOT NULL
      AND (e.gender <> 'self_describe' OR length(trim(COALESCE(e.gender_self_description, ''))) >= 2)
      AND e.nationality_code IS NOT NULL
      AND e.ethnicity IS NOT NULL
      AND e.dietary_pattern IS NOT NULL
      AND (e.dietary_pattern <> 'other' OR length(trim(COALESCE(e.dietary_other, ''))) >= 2)
      AND e.smoker_status IS NOT NULL
      AND e.weekly_food_spend IS NOT NULL
      AND (e.household_size IS NOT NULL OR e.household_size_prefer_not_to_say)
      AND e.occupation_group IS NOT NULL
      AND e.annual_income_range IS NOT NULL
      AND e.grocery_role IS NOT NULL
      AND e.category_usage_frequency IS NOT NULL
  ) INTO v_ready;
  IF NOT v_ready THEN RAISE EXCEPTION 'Complete the required research profile before joining a study'; END IF;
  RETURN NEW;
END;
$$;

UPDATE public.profiles p
SET eligibility_completed_at = NULL
FROM public.panelist_eligibility_profiles e
WHERE p.id = e.panelist_id AND p.org_id = e.org_id AND p.role = 'panelist'
  AND p.eligibility_completed_at IS NOT NULL
  AND (
    e.nationality_code IS NULL OR e.ethnicity IS NULL OR e.smoker_status IS NULL
    OR e.weekly_food_spend IS NULL
    OR (e.household_size IS NULL AND NOT e.household_size_prefer_not_to_say)
    OR e.occupation_group IS NULL OR e.annual_income_range IS NULL
  );

UPDATE public.products p
SET assigned_panelist_ids = COALESCE((
  SELECT array_agg(assigned.panelist_id)
  FROM unnest(COALESCE(p.assigned_panelist_ids, ARRAY[]::text[])) AS assigned(panelist_id)
  WHERE public.panelist_is_eligible_for_sample(assigned.panelist_id::uuid, p.id, NULL)
), ARRAY[]::text[])
WHERE cardinality(COALESCE(p.assigned_panelist_ids, ARRAY[]::text[])) > 0;

UPDATE public.concept_tests ct
SET assigned_panelist_ids = COALESCE((
  SELECT array_agg(assigned.panelist_id)
  FROM unnest(COALESCE(ct.assigned_panelist_ids, ARRAY[]::text[])) AS assigned(panelist_id)
  WHERE public.panelist_is_eligible_for_sample(assigned.panelist_id::uuid, NULL, ct.formulation_version_id)
), ARRAY[]::text[])
WHERE cardinality(COALESCE(ct.assigned_panelist_ids, ARRAY[]::text[])) > 0;

DROP FUNCTION public.list_panelist_directory();
CREATE FUNCTION public.list_panelist_directory()
RETURNS TABLE (
  id uuid, name text, email text, panelist_id text, status text,
  consent_accepted_at timestamptz, consent_version text, completed_count bigint,
  training_level text, phone text, address_line_1 text, address_line_2 text,
  city text, region text, postal_code text, country text,
  profile_completed_at timestamptz, eligibility_completed_at timestamptz,
  age_years smallint, age_band text, gender text, gender_self_description text,
  nationality_code text, ethnicity text, household_size smallint,
  household_size_prefer_not_to_say boolean, children_in_household boolean,
  dietary_pattern text, dietary_other text, grocery_role text,
  category_usage_frequency text, smoker_status text, weekly_food_spend text,
  occupation_group text, annual_income_range text,
  declaration_confirmed_at timestamptz, declaration_expires_at timestamptz,
  research_profile_updated_at timestamptz, last_activity_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.name, p.email, p.panelist_id, p.status,
    p.consent_accepted_at, p.consent_version,
    ((SELECT count(*) FROM public.responses r WHERE r.user_id = p.id)
      + (SELECT count(*) FROM public.concept_responses cr WHERE cr.user_id = p.id))::bigint,
    p.training_level, p.phone, p.address_line_1, p.address_line_2,
    p.city, p.region, p.postal_code, p.country,
    p.profile_completed_at, p.eligibility_completed_at,
    CASE WHEN e.panelist_id IS NULL THEN NULL ELSE extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1)))::smallint END,
    CASE
      WHEN e.panelist_id IS NULL THEN NULL
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 25 THEN '18–24'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 35 THEN '25–34'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 45 THEN '35–44'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 55 THEN '45–54'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 65 THEN '55–64'
      ELSE '65+'
    END,
    e.gender, e.gender_self_description, e.nationality_code, e.ethnicity,
    e.household_size, COALESCE(e.household_size_prefer_not_to_say, false),
    e.children_in_household, e.dietary_pattern, e.dietary_other,
    e.grocery_role, e.category_usage_frequency, e.smoker_status,
    e.weekly_food_spend, e.occupation_group, e.annual_income_range,
    e.declaration_confirmed_at, e.declaration_expires_at, e.updated_at,
    GREATEST(
      (SELECT max(r.created_at) FROM public.responses r WHERE r.user_id = p.id),
      (SELECT max(cr.created_at) FROM public.concept_responses cr WHERE cr.user_id = p.id)
    )
  FROM public.profiles p
  LEFT JOIN public.panelist_eligibility_profiles e ON e.panelist_id = p.id AND e.org_id = p.org_id
  WHERE public.is_admin() AND p.org_id = public.current_org_id() AND p.role = 'panelist'
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_panelist_directory() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_panelist_directory() TO authenticated;

CREATE FUNCTION public.get_own_panelist_profile_setup()
RETURNS TABLE (
  name text, phone text, address_line_1 text, address_line_2 text, city text,
  region text, postal_code text, country text, birth_month smallint, birth_year smallint,
  allergen_avoidances text[], other_avoidances text[], gender text,
  gender_self_description text, nationality_code text, ethnicity text,
  household_size smallint, household_size_prefer_not_to_say boolean,
  children_in_household boolean, dietary_pattern text, dietary_other text,
  grocery_role text, category_usage_frequency text, smoker_status text,
  weekly_food_spend text, occupation_group text, annual_income_range text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.name, p.phone, p.address_line_1, p.address_line_2, p.city, p.region,
    p.postal_code, p.country, e.birth_month, e.birth_year,
    e.allergen_avoidances, e.other_avoidances, e.gender,
    e.gender_self_description, e.nationality_code, e.ethnicity,
    e.household_size, e.household_size_prefer_not_to_say,
    e.children_in_household, e.dietary_pattern, e.dietary_other,
    e.grocery_role, e.category_usage_frequency, e.smoker_status,
    e.weekly_food_spend, e.occupation_group, e.annual_income_range
  FROM public.profiles p
  LEFT JOIN public.panelist_eligibility_profiles e ON e.panelist_id = p.id AND e.org_id = p.org_id
  WHERE p.id = auth.uid() AND p.role = 'panelist' AND p.org_id = public.current_org_id();
$$;

REVOKE ALL ON FUNCTION public.get_own_panelist_profile_setup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_own_panelist_profile_setup() TO authenticated;

CREATE OR REPLACE FUNCTION public.capture_response_demographic_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_profile public.profiles%ROWTYPE; v_eligibility public.panelist_eligibility_profiles%ROWTYPE; v_age integer;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;
  SELECT * INTO v_eligibility FROM public.panelist_eligibility_profiles WHERE panelist_id = NEW.user_id;
  IF v_profile.id IS NULL OR v_eligibility.panelist_id IS NULL THEN RETURN NEW; END IF;
  v_age := extract(year FROM age(COALESCE(NEW.created_at, now())::date, make_date(v_eligibility.birth_year, v_eligibility.birth_month, 1)))::integer;
  INSERT INTO public.response_demographic_snapshots (
    org_id, panelist_id, response_id, concept_response_id, age_years, age_band,
    gender, gender_self_description, nationality_code, ethnicity, region,
    household_size, household_size_prefer_not_to_say, children_in_household,
    dietary_pattern, dietary_other, grocery_role, category_usage_frequency,
    smoker_status, weekly_food_spend, occupation_group, annual_income_range, captured_at
  ) VALUES (
    v_profile.org_id, NEW.user_id,
    CASE WHEN TG_TABLE_NAME = 'responses' THEN NEW.id ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'concept_responses' THEN NEW.id ELSE NULL END,
    v_age,
    CASE WHEN v_age < 25 THEN '18–24' WHEN v_age < 35 THEN '25–34'
      WHEN v_age < 45 THEN '35–44' WHEN v_age < 55 THEN '45–54'
      WHEN v_age < 65 THEN '55–64' ELSE '65+' END,
    v_eligibility.gender, v_eligibility.gender_self_description,
    v_eligibility.nationality_code, v_eligibility.ethnicity, v_profile.region,
    v_eligibility.household_size, v_eligibility.household_size_prefer_not_to_say,
    v_eligibility.children_in_household, v_eligibility.dietary_pattern,
    v_eligibility.dietary_other, v_eligibility.grocery_role,
    v_eligibility.category_usage_frequency, v_eligibility.smoker_status,
    v_eligibility.weekly_food_spend, v_eligibility.occupation_group,
    v_eligibility.annual_income_range, COALESCE(NEW.created_at, now())
  ) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP FUNCTION public.list_eligible_panelists(uuid,uuid);
CREATE FUNCTION public.list_eligible_panelists(
  p_product_id uuid DEFAULT NULL,
  p_formulation_version_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, name text, email text, panelist_id text, completed_count bigint,
  age_years smallint, age_band text, gender text, gender_self_description text,
  nationality_code text, ethnicity text, region text, household_size smallint,
  household_size_prefer_not_to_say boolean, children_in_household boolean,
  dietary_pattern text, dietary_other text, grocery_role text,
  category_usage_frequency text, smoker_status text, weekly_food_spend text,
  occupation_group text, annual_income_range text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.name, p.email, p.panelist_id,
    ((SELECT count(*) FROM public.responses r WHERE r.user_id = p.id)
      + (SELECT count(*) FROM public.concept_responses cr WHERE cr.user_id = p.id))::bigint,
    extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1)))::smallint,
    CASE
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 25 THEN '18–24'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 35 THEN '25–34'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 45 THEN '35–44'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 55 THEN '45–54'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 65 THEN '55–64'
      ELSE '65+'
    END,
    e.gender, e.gender_self_description, e.nationality_code, e.ethnicity, p.region,
    e.household_size, e.household_size_prefer_not_to_say, e.children_in_household,
    e.dietary_pattern, e.dietary_other, e.grocery_role, e.category_usage_frequency,
    e.smoker_status, e.weekly_food_spend, e.occupation_group, e.annual_income_range
  FROM public.profiles p
  JOIN public.panelist_eligibility_profiles e ON e.panelist_id = p.id
  WHERE public.is_admin() AND p.org_id = public.current_org_id()
    AND public.panelist_is_eligible_for_sample(p.id, p_product_id, p_formulation_version_id)
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_eligible_panelists(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_eligible_panelists(uuid,uuid) TO authenticated;

DROP FUNCTION public.list_eligible_panelists_for_products(uuid[]);
CREATE FUNCTION public.list_eligible_panelists_for_products(p_product_ids uuid[])
RETURNS TABLE (
  id uuid, name text, email text, panelist_id text, completed_count bigint,
  age_years smallint, age_band text, gender text, gender_self_description text,
  nationality_code text, ethnicity text, region text, household_size smallint,
  household_size_prefer_not_to_say boolean, children_in_household boolean,
  dietary_pattern text, dietary_other text, grocery_role text,
  category_usage_frequency text, smoker_status text, weekly_food_spend text,
  occupation_group text, annual_income_range text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.name, p.email, p.panelist_id,
    ((SELECT count(*) FROM public.responses r WHERE r.user_id = p.id)
      + (SELECT count(*) FROM public.concept_responses cr WHERE cr.user_id = p.id))::bigint,
    extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1)))::smallint,
    CASE
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 25 THEN '18–24'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 35 THEN '25–34'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 45 THEN '35–44'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 55 THEN '45–54'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 65 THEN '55–64'
      ELSE '65+'
    END,
    e.gender, e.gender_self_description, e.nationality_code, e.ethnicity, p.region,
    e.household_size, e.household_size_prefer_not_to_say, e.children_in_household,
    e.dietary_pattern, e.dietary_other, e.grocery_role, e.category_usage_frequency,
    e.smoker_status, e.weekly_food_spend, e.occupation_group, e.annual_income_range
  FROM public.profiles p
  JOIN public.panelist_eligibility_profiles e ON e.panelist_id = p.id
  WHERE public.is_admin() AND p.org_id = public.current_org_id()
    AND cardinality(COALESCE(p_product_ids, ARRAY[]::uuid[])) > 0
    AND NOT EXISTS (
      SELECT 1 FROM unnest(p_product_ids) AS requested(product_id)
      WHERE NOT public.panelist_is_eligible_for_sample(p.id, requested.product_id, NULL)
    )
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_eligible_panelists_for_products(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_eligible_panelists_for_products(uuid[]) TO authenticated;
