-- Category usage is study-specific. Panelists cannot answer it accurately
-- during account setup because their invited product categories are not known
-- yet. Keep the nullable column for future study-level screeners, but stop
-- requiring or collecting it as part of the reusable panelist profile.

CREATE OR REPLACE FUNCTION public.complete_panelist_eligibility_profile(
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
  IF p_grocery_role IS NULL THEN RAISE EXCEPTION 'Choose a grocery-shopping response'; END IF;

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
    p_grocery_role, NULL, p_smoker_status, p_weekly_food_spend,
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
    category_usage_frequency = NULL,
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
  ) INTO v_ready;
  IF NOT v_ready THEN RAISE EXCEPTION 'Complete the required research profile before joining a study'; END IF;
  RETURN NEW;
END;
$$;
