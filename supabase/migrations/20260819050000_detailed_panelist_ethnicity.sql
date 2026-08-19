-- Store the detailed England and Wales Census 2021 ethnicity response while
-- retaining the five broad values already collected from existing panelists.
-- Broad groups are derived for reporting instead of asking panelists to choose
-- an imprecise umbrella category as their final answer.

CREATE FUNCTION public.panelist_ethnicity_group(p_ethnicity text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_ethnicity IN (
      'white', 'white_british', 'white_irish', 'white_gypsy_or_irish_traveller',
      'white_roma', 'white_other'
    ) THEN 'white'
    WHEN p_ethnicity IN (
      'mixed', 'mixed_white_black_caribbean', 'mixed_white_black_african',
      'mixed_white_asian', 'mixed_other'
    ) THEN 'mixed'
    WHEN p_ethnicity IN (
      'asian', 'asian_indian', 'asian_pakistani', 'asian_bangladeshi',
      'asian_chinese', 'asian_other'
    ) THEN 'asian'
    WHEN p_ethnicity IN (
      'black', 'black_african', 'black_caribbean', 'black_other'
    ) THEN 'black'
    WHEN p_ethnicity IN ('other', 'other_arab', 'other_ethnic_group') THEN 'other'
    WHEN p_ethnicity = 'prefer_not_to_say' THEN 'prefer_not_to_say'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.panelist_ethnicity_group(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.panelist_ethnicity_group(text) TO authenticated;

ALTER TABLE public.panelist_eligibility_profiles
  DROP CONSTRAINT panelist_eligibility_profiles_ethnicity_check,
  ADD CONSTRAINT panelist_eligibility_profiles_ethnicity_check CHECK (
    ethnicity IS NULL OR public.panelist_ethnicity_group(ethnicity) IS NOT NULL
  );

-- Keep the original RPC available for older clients. The current client uses
-- this atomic wrapper: the established RPC performs all profile validation and
-- writes, then the detailed response replaces its derived broad group.
CREATE FUNCTION public.complete_panelist_eligibility_profile_v2(
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
  v_ethnicity_group text := public.panelist_ethnicity_group(p_ethnicity);
BEGIN
  IF v_ethnicity_group IS NULL
     OR p_ethnicity IN ('white', 'mixed', 'asian', 'black', 'other') THEN
    RAISE EXCEPTION 'Choose the specific ethnic background that best describes you';
  END IF;

  PERFORM public.complete_panelist_eligibility_profile(
    p_name => p_name,
    p_phone => p_phone,
    p_address_line_1 => p_address_line_1,
    p_address_line_2 => p_address_line_2,
    p_city => p_city,
    p_region => p_region,
    p_postal_code => p_postal_code,
    p_country => p_country,
    p_consent_version => p_consent_version,
    p_consent_user_agent => p_consent_user_agent,
    p_birth_month => p_birth_month,
    p_birth_year => p_birth_year,
    p_allergen_avoidances => p_allergen_avoidances,
    p_other_avoidances => p_other_avoidances,
    p_health_consent_version => p_health_consent_version,
    p_gender => p_gender,
    p_household_size => p_household_size,
    p_children_in_household => p_children_in_household,
    p_dietary_pattern => p_dietary_pattern,
    p_grocery_role => p_grocery_role,
    p_category_usage_frequency => p_category_usage_frequency,
    p_gender_self_description => p_gender_self_description,
    p_nationality_code => p_nationality_code,
    p_ethnicity => v_ethnicity_group,
    p_dietary_other => p_dietary_other,
    p_smoker_status => p_smoker_status,
    p_weekly_food_spend => p_weekly_food_spend,
    p_household_size_prefer_not_to_say => p_household_size_prefer_not_to_say,
    p_occupation_group => p_occupation_group,
    p_annual_income_range => p_annual_income_range
  );

  UPDATE public.panelist_eligibility_profiles
  SET ethnicity = p_ethnicity,
      updated_at = now()
  WHERE panelist_id = auth.uid()
    AND org_id = public.current_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The panelist research profile could not be updated';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_panelist_eligibility_profile_v2(text,text,text,text,text,text,text,text,text,text,integer,integer,text[],text[],text,text,integer,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_panelist_eligibility_profile_v2(text,text,text,text,text,text,text,text,text,text,integer,integer,text[],text[],text,text,integer,boolean,text,text,text,text,text,text,text,text,text,boolean,text,text) TO authenticated;
