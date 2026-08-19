-- Invite-only panel eligibility, exact-sample allergen declarations, and
-- assignment enforcement. Health declarations stay separate from general
-- panelist profiles; administrator selectors receive eligible rows only.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS eligibility_completed_at timestamptz;

CREATE TABLE public.panelist_eligibility_profiles (
  panelist_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  birth_month smallint NOT NULL CHECK (birth_month BETWEEN 1 AND 12),
  birth_year smallint NOT NULL CHECK (birth_year BETWEEN 1900 AND 2200),
  adult_confirmed_at timestamptz NOT NULL,
  allergen_avoidances text[] NOT NULL DEFAULT '{}',
  other_avoidances text[] NOT NULL DEFAULT '{}',
  declaration_confirmed_at timestamptz NOT NULL,
  declaration_expires_at timestamptz NOT NULL,
  health_consent_at timestamptz NOT NULL,
  health_consent_version text NOT NULL,
  gender text CHECK (gender IS NULL OR gender IN ('woman', 'man', 'non_binary', 'self_describe', 'prefer_not_to_say')),
  household_size smallint CHECK (household_size IS NULL OR household_size BETWEEN 1 AND 20),
  children_in_household boolean,
  dietary_pattern text CHECK (dietary_pattern IS NULL OR dietary_pattern IN ('no_specific_diet', 'vegetarian', 'vegan', 'pescatarian', 'flexitarian', 'halal', 'kosher', 'other', 'prefer_not_to_say')),
  grocery_role text CHECK (grocery_role IS NULL OR grocery_role IN ('main_shopper', 'shared_shopper', 'occasional_shopper', 'not_involved', 'prefer_not_to_say')),
  category_usage_frequency text CHECK (category_usage_frequency IS NULL OR category_usage_frequency IN ('daily', 'several_weekly', 'weekly', 'monthly', 'less_often', 'never', 'prefer_not_to_say')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (allergen_avoidances <@ ARRAY[
    'celery', 'cereals_containing_gluten', 'crustaceans', 'eggs', 'fish',
    'lupin', 'milk', 'molluscs', 'mustard', 'peanuts', 'sesame',
    'soybeans', 'sulphites', 'tree_nuts'
  ]::text[])
);

CREATE INDEX idx_panelist_eligibility_profiles_org
  ON public.panelist_eligibility_profiles(org_id);
CREATE INDEX idx_panelist_eligibility_profiles_allergens
  ON public.panelist_eligibility_profiles USING gin(allergen_avoidances);

CREATE TABLE public.sample_allergen_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  formulation_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE CASCADE,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'verified', 'superseded')),
  contains_allergens text[] NOT NULL DEFAULT '{}',
  may_contain_allergens text[] NOT NULL DEFAULT '{}',
  other_allergens text[] NOT NULL DEFAULT '{}',
  ingredient_statement text,
  is_current boolean NOT NULL DEFAULT true,
  verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((product_id IS NOT NULL)::integer + (formulation_version_id IS NOT NULL)::integer = 1),
  CHECK (contains_allergens <@ ARRAY[
    'celery', 'cereals_containing_gluten', 'crustaceans', 'eggs', 'fish',
    'lupin', 'milk', 'molluscs', 'mustard', 'peanuts', 'sesame',
    'soybeans', 'sulphites', 'tree_nuts'
  ]::text[]),
  CHECK (may_contain_allergens <@ ARRAY[
    'celery', 'cereals_containing_gluten', 'crustaceans', 'eggs', 'fish',
    'lupin', 'milk', 'molluscs', 'mustard', 'peanuts', 'sesame',
    'soybeans', 'sulphites', 'tree_nuts'
  ]::text[]),
  CHECK (
    (status = 'verified' AND verified_by IS NOT NULL AND verified_at IS NOT NULL)
    OR status <> 'verified'
  )
);

CREATE UNIQUE INDEX uq_sample_allergen_declaration_product_current
  ON public.sample_allergen_declarations(product_id) WHERE product_id IS NOT NULL AND is_current;
CREATE UNIQUE INDEX uq_sample_allergen_declaration_formulation_current
  ON public.sample_allergen_declarations(formulation_version_id) WHERE formulation_version_id IS NOT NULL AND is_current;
CREATE INDEX idx_sample_allergen_declarations_org
  ON public.sample_allergen_declarations(org_id);

CREATE TABLE public.response_demographic_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  panelist_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  response_id uuid UNIQUE REFERENCES public.responses(id) ON DELETE CASCADE,
  concept_response_id uuid UNIQUE REFERENCES public.concept_responses(id) ON DELETE CASCADE,
  age_band text NOT NULL,
  gender text,
  region text,
  household_size smallint,
  children_in_household boolean,
  dietary_pattern text,
  grocery_role text,
  category_usage_frequency text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((response_id IS NOT NULL)::integer + (concept_response_id IS NOT NULL)::integer = 1)
);

CREATE INDEX idx_response_demographic_snapshots_org
  ON public.response_demographic_snapshots(org_id);
CREATE INDEX idx_response_demographic_snapshots_panelist
  ON public.response_demographic_snapshots(panelist_id);

ALTER TABLE public.panelist_eligibility_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sample_allergen_declarations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_demographic_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY panelist_eligibility_profiles_own_select
  ON public.panelist_eligibility_profiles FOR SELECT TO authenticated
  USING (panelist_id = auth.uid() AND org_id = public.current_org_id());
CREATE POLICY panelist_eligibility_profiles_own_insert
  ON public.panelist_eligibility_profiles FOR INSERT TO authenticated
  WITH CHECK (panelist_id = auth.uid() AND org_id = public.current_org_id());
CREATE POLICY panelist_eligibility_profiles_own_update
  ON public.panelist_eligibility_profiles FOR UPDATE TO authenticated
  USING (panelist_id = auth.uid() AND org_id = public.current_org_id())
  WITH CHECK (panelist_id = auth.uid() AND org_id = public.current_org_id());

CREATE POLICY sample_allergen_declarations_admin_all
  ON public.sample_allergen_declarations FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin() AND org_id = public.current_org_id());

CREATE POLICY response_demographic_snapshots_admin_select
  ON public.response_demographic_snapshots FOR SELECT TO authenticated
  USING (public.is_admin() AND org_id = public.current_org_id());
CREATE POLICY response_demographic_snapshots_own_select
  ON public.response_demographic_snapshots FOR SELECT TO authenticated
  USING (panelist_id = auth.uid() AND org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE ON public.panelist_eligibility_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sample_allergen_declarations TO authenticated;
GRANT SELECT ON public.response_demographic_snapshots TO authenticated;

DROP FUNCTION IF EXISTS public.complete_panelist_profile(text, text, text, text, text, text, text, text, text, text);
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
  p_category_usage_frequency text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_birth_month integer := p_birth_month;
  v_birth_year integer := p_birth_year;
  v_avoidances text[];
  v_other text[];
  v_latest_possible_birth_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to complete your profile';
  END IF;
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
  IF v_birth_month NOT BETWEEN 1 AND 12 OR v_birth_year NOT BETWEEN 1900 AND extract(year FROM current_date)::integer THEN
    RAISE EXCEPTION 'Enter a valid month and year of birth';
  END IF;
  v_latest_possible_birth_date := (make_date(v_birth_year, v_birth_month, 1) + interval '1 month - 1 day')::date;
  IF v_latest_possible_birth_date > (current_date - interval '18 years')::date THEN
    RAISE EXCEPTION 'Panel participation is limited to adults aged 18 or over';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT lower(trim(value))) FILTER (WHERE trim(value) <> ''), ARRAY[]::text[])
  INTO v_avoidances FROM unnest(COALESCE(p_allergen_avoidances, ARRAY[]::text[])) AS item(value);
  IF NOT v_avoidances <@ ARRAY[
    'celery', 'cereals_containing_gluten', 'crustaceans', 'eggs', 'fish',
    'lupin', 'milk', 'molluscs', 'mustard', 'peanuts', 'sesame',
    'soybeans', 'sulphites', 'tree_nuts'
  ]::text[] THEN
    RAISE EXCEPTION 'One or more allergen selections are not recognized';
  END IF;
  SELECT COALESCE(array_agg(DISTINCT lower(trim(value))) FILTER (WHERE trim(value) <> ''), ARRAY[]::text[])
  INTO v_other FROM unnest(COALESCE(p_other_avoidances, ARRAY[]::text[])) AS item(value);

  SELECT p.org_id INTO v_org_id
  FROM public.profiles AS p
  WHERE p.id = v_user_id AND p.role = 'panelist' AND p.status = 'active'
  FOR UPDATE;
  IF v_org_id IS NULL THEN RAISE EXCEPTION 'An active panelist account was not found'; END IF;

  INSERT INTO public.panelist_eligibility_profiles (
    panelist_id, org_id, birth_month, birth_year, adult_confirmed_at,
    allergen_avoidances, other_avoidances, declaration_confirmed_at,
    declaration_expires_at, health_consent_at, health_consent_version,
    gender, household_size, children_in_household, dietary_pattern,
    grocery_role, category_usage_frequency, updated_at
  ) VALUES (
    v_user_id, v_org_id, v_birth_month, v_birth_year, now(),
    v_avoidances, v_other, now(), now() + interval '1 year', now(), trim(p_health_consent_version),
    NULLIF(p_gender, ''), p_household_size, p_children_in_household,
    NULLIF(p_dietary_pattern, ''), NULLIF(p_grocery_role, ''),
    NULLIF(p_category_usage_frequency, ''), now()
  )
  ON CONFLICT (panelist_id) DO UPDATE SET
    birth_month = EXCLUDED.birth_month,
    birth_year = EXCLUDED.birth_year,
    adult_confirmed_at = EXCLUDED.adult_confirmed_at,
    allergen_avoidances = EXCLUDED.allergen_avoidances,
    other_avoidances = EXCLUDED.other_avoidances,
    declaration_confirmed_at = EXCLUDED.declaration_confirmed_at,
    declaration_expires_at = EXCLUDED.declaration_expires_at,
    health_consent_at = EXCLUDED.health_consent_at,
    health_consent_version = EXCLUDED.health_consent_version,
    gender = EXCLUDED.gender,
    household_size = EXCLUDED.household_size,
    children_in_household = EXCLUDED.children_in_household,
    dietary_pattern = EXCLUDED.dietary_pattern,
    grocery_role = EXCLUDED.grocery_role,
    category_usage_frequency = EXCLUDED.category_usage_frequency,
    updated_at = now();

  UPDATE public.profiles AS p SET
    name = trim(p_name), phone = trim(p_phone), address_line_1 = trim(p_address_line_1),
    address_line_2 = NULLIF(trim(COALESCE(p_address_line_2, '')), ''), city = trim(p_city),
    region = NULLIF(trim(COALESCE(p_region, '')), ''), postal_code = trim(p_postal_code),
    country = trim(p_country), consent_accepted_at = now(), consent_version = trim(p_consent_version),
    consent_user_agent = NULLIF(trim(COALESCE(p_consent_user_agent, '')), ''),
    profile_completed_at = COALESCE(p.profile_completed_at, now()), eligibility_completed_at = now()
  WHERE p.id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_panelist_eligibility_profile(text,text,text,text,text,text,text,text,text,text,integer,integer,text[],text[],text,text,integer,boolean,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_panelist_eligibility_profile(text,text,text,text,text,text,text,text,text,text,integer,integer,text[],text[],text,text,integer,boolean,text,text,text) TO authenticated;

CREATE FUNCTION public.save_sample_allergen_declaration(
  p_product_id uuid DEFAULT NULL,
  p_formulation_version_id uuid DEFAULT NULL,
  p_contains_allergens text[] DEFAULT '{}',
  p_may_contain_allergens text[] DEFAULT '{}',
  p_other_allergens text[] DEFAULT '{}',
  p_ingredient_statement text DEFAULT NULL,
  p_verify boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_id uuid;
  v_version integer;
  v_contains text[];
  v_may_contain text[];
  v_other text[];
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can review sample allergens'; END IF;
  IF (p_product_id IS NOT NULL)::integer + (p_formulation_version_id IS NOT NULL)::integer <> 1 THEN
    RAISE EXCEPTION 'Choose exactly one product or formulation version';
  END IF;
  IF p_product_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = p_product_id AND p.org_id = v_org
  ) THEN RAISE EXCEPTION 'Product not found for this workspace'; END IF;
  IF p_formulation_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.formulation_versions f WHERE f.id = p_formulation_version_id AND f.org_id = v_org
  ) THEN RAISE EXCEPTION 'Formulation version not found for this workspace'; END IF;

  SELECT COALESCE(array_agg(DISTINCT lower(trim(value))) FILTER (WHERE trim(value) <> ''), ARRAY[]::text[])
    INTO v_contains FROM unnest(COALESCE(p_contains_allergens, ARRAY[]::text[])) AS item(value);
  SELECT COALESCE(array_agg(DISTINCT lower(trim(value))) FILTER (WHERE trim(value) <> ''), ARRAY[]::text[])
    INTO v_may_contain FROM unnest(COALESCE(p_may_contain_allergens, ARRAY[]::text[])) AS item(value);
  SELECT COALESCE(array_agg(DISTINCT lower(trim(value))) FILTER (WHERE trim(value) <> ''), ARRAY[]::text[])
    INTO v_other FROM unnest(COALESCE(p_other_allergens, ARRAY[]::text[])) AS item(value);
  IF NOT (v_contains || v_may_contain) <@ ARRAY[
    'celery', 'cereals_containing_gluten', 'crustaceans', 'eggs', 'fish',
    'lupin', 'milk', 'molluscs', 'mustard', 'peanuts', 'sesame',
    'soybeans', 'sulphites', 'tree_nuts'
  ]::text[] THEN RAISE EXCEPTION 'One or more allergen selections are not recognized'; END IF;

  SELECT COALESCE(max(d.version), 0) + 1 INTO v_version
  FROM public.sample_allergen_declarations d
  WHERE d.org_id = v_org
    AND ((p_product_id IS NOT NULL AND d.product_id = p_product_id)
      OR (p_formulation_version_id IS NOT NULL AND d.formulation_version_id = p_formulation_version_id));

  UPDATE public.sample_allergen_declarations d
  SET is_current = false, status = 'superseded', updated_at = now()
  WHERE d.org_id = v_org AND d.is_current
    AND ((p_product_id IS NOT NULL AND d.product_id = p_product_id)
      OR (p_formulation_version_id IS NOT NULL AND d.formulation_version_id = p_formulation_version_id));

  INSERT INTO public.sample_allergen_declarations (
    org_id, product_id, formulation_version_id, version, status,
    contains_allergens, may_contain_allergens, other_allergens,
    ingredient_statement, is_current, verified_by, verified_at, created_by
  ) VALUES (
    v_org, p_product_id, p_formulation_version_id, v_version,
    CASE WHEN p_verify THEN 'verified' ELSE 'draft' END,
    v_contains, v_may_contain, v_other, NULLIF(trim(COALESCE(p_ingredient_statement, '')), ''),
    true, CASE WHEN p_verify THEN auth.uid() ELSE NULL END,
    CASE WHEN p_verify THEN now() ELSE NULL END, auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_sample_allergen_declaration(uuid,uuid,text[],text[],text[],text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_sample_allergen_declaration(uuid,uuid,text[],text[],text[],text,boolean) TO authenticated;

CREATE FUNCTION public.panelist_is_eligible_for_sample(
  p_panelist_id uuid,
  p_product_id uuid DEFAULT NULL,
  p_formulation_version_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.panelist_eligibility_profiles e ON e.panelist_id = p.id AND e.org_id = p.org_id
    JOIN public.sample_allergen_declarations d ON d.org_id = p.org_id
      AND d.is_current AND d.status = 'verified'
      AND ((p_product_id IS NOT NULL AND d.product_id = p_product_id)
        OR (p_formulation_version_id IS NOT NULL AND d.formulation_version_id = p_formulation_version_id))
    WHERE p.id = p_panelist_id
      AND p.role = 'panelist' AND p.status = 'active'
      AND p.profile_completed_at IS NOT NULL AND p.eligibility_completed_at IS NOT NULL
      AND e.adult_confirmed_at IS NOT NULL
      AND e.declaration_expires_at >= now()
      AND (make_date(e.birth_year, e.birth_month, 1) + interval '1 month - 1 day')::date
        <= (current_date - interval '18 years')::date
      AND NOT (e.allergen_avoidances && (d.contains_allergens || d.may_contain_allergens))
      AND NOT (e.other_avoidances && d.other_allergens)
  );
$$;

REVOKE ALL ON FUNCTION public.panelist_is_eligible_for_sample(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.panelist_is_eligible_for_sample(uuid,uuid,uuid) TO authenticated;

CREATE FUNCTION public.list_eligible_panelists(
  p_product_id uuid DEFAULT NULL,
  p_formulation_version_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid, name text, email text, panelist_id text, completed_count bigint,
  age_band text, gender text, region text, household_size smallint,
  children_in_household boolean, dietary_pattern text, grocery_role text,
  category_usage_frequency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.name, p.email, p.panelist_id,
    (SELECT count(*) FROM public.responses r WHERE r.user_id = p.id) AS completed_count,
    CASE
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 25 THEN '18–24'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 35 THEN '25–34'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 45 THEN '35–44'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 55 THEN '45–54'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 65 THEN '55–64'
      ELSE '65+'
    END AS age_band,
    e.gender, p.region, e.household_size, e.children_in_household,
    e.dietary_pattern, e.grocery_role, e.category_usage_frequency
  FROM public.profiles p
  JOIN public.panelist_eligibility_profiles e ON e.panelist_id = p.id
  WHERE public.is_admin() AND p.org_id = public.current_org_id()
    AND public.panelist_is_eligible_for_sample(p.id, p_product_id, p_formulation_version_id)
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_eligible_panelists(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_eligible_panelists(uuid,uuid) TO authenticated;

CREATE FUNCTION public.list_eligible_panelists_for_products(p_product_ids uuid[])
RETURNS TABLE (
  id uuid, name text, email text, panelist_id text, completed_count bigint,
  age_band text, gender text, region text, household_size smallint,
  children_in_household boolean, dietary_pattern text, grocery_role text,
  category_usage_frequency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.name, p.email, p.panelist_id,
    (SELECT count(*) FROM public.responses r WHERE r.user_id = p.id) AS completed_count,
    CASE
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 25 THEN '18–24'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 35 THEN '25–34'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 45 THEN '35–44'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 55 THEN '45–54'
      WHEN extract(year FROM age(current_date, make_date(e.birth_year, e.birth_month, 1))) < 65 THEN '55–64'
      ELSE '65+'
    END AS age_band,
    e.gender, p.region, e.household_size, e.children_in_household,
    e.dietary_pattern, e.grocery_role, e.category_usage_frequency
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

CREATE FUNCTION public.replace_product_panelist_assignments(
  p_product_ids uuid[], p_panelist_ids uuid[]
)
RETURNS SETOF public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_product_id uuid;
  v_panelist_id uuid;
  v_panelist_text_ids text[];
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Only admins can assign panelists'; END IF;
  FOREACH v_product_id IN ARRAY COALESCE(p_product_ids, ARRAY[]::uuid[]) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = v_product_id AND p.org_id = v_org) THEN
      RAISE EXCEPTION 'Product % was not found in this workspace', v_product_id;
    END IF;
    FOREACH v_panelist_id IN ARRAY COALESCE(p_panelist_ids, ARRAY[]::uuid[]) LOOP
      IF NOT public.panelist_is_eligible_for_sample(v_panelist_id, v_product_id, NULL) THEN
        RAISE EXCEPTION 'Panelist % is not eligible for product %', v_panelist_id, v_product_id;
      END IF;
    END LOOP;
  END LOOP;
  SELECT COALESCE(array_agg(value::text), ARRAY[]::text[])
  INTO v_panelist_text_ids
  FROM unnest(COALESCE(p_panelist_ids, ARRAY[]::uuid[])) AS item(value);
  RETURN QUERY
    UPDATE public.products p SET assigned_panelist_ids = v_panelist_text_ids
    WHERE p.id = ANY(COALESCE(p_product_ids, ARRAY[]::uuid[])) AND p.org_id = v_org
    RETURNING p.*;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_product_panelist_assignments(uuid[],uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_product_panelist_assignments(uuid[],uuid[]) TO authenticated;

CREATE FUNCTION public.assert_safe_sample_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_panelist text;
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    FOREACH v_panelist IN ARRAY COALESCE(NEW.assigned_panelist_ids, ARRAY[]::text[]) LOOP
      IF NOT public.panelist_is_eligible_for_sample(v_panelist::uuid, NEW.id, NULL) THEN
        RAISE EXCEPTION 'A selected panelist is not eligible for this product';
      END IF;
    END LOOP;
  ELSIF TG_TABLE_NAME = 'concept_tests' THEN
    FOREACH v_panelist IN ARRAY COALESCE(NEW.assigned_panelist_ids, ARRAY[]::text[]) LOOP
      IF NEW.formulation_version_id IS NULL
         OR NOT public.panelist_is_eligible_for_sample(v_panelist::uuid, NULL, NEW.formulation_version_id) THEN
        RAISE EXCEPTION 'A selected panelist is not eligible for this concept sample';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_safe_assignment ON public.products;
CREATE TRIGGER trg_products_safe_assignment
  BEFORE INSERT OR UPDATE OF assigned_panelist_ids ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.assert_safe_sample_assignment();
DROP TRIGGER IF EXISTS trg_concept_tests_safe_assignment ON public.concept_tests;
CREATE TRIGGER trg_concept_tests_safe_assignment
  BEFORE INSERT OR UPDATE OF assigned_panelist_ids, formulation_version_id ON public.concept_tests
  FOR EACH ROW EXECUTE FUNCTION public.assert_safe_sample_assignment();

DROP POLICY IF EXISTS products_select_authenticated ON public.products;
CREATE POLICY products_select_authenticated ON public.products FOR SELECT TO authenticated
USING (
  public.is_active_user() AND (
    public.is_admin() OR (
      status = 'active'
      AND assigned_panelist_ids @> ARRAY[auth.uid()::text]
      AND public.panelist_is_eligible_for_sample(auth.uid(), id, NULL)
    )
  )
);

DROP POLICY IF EXISTS concept_tests_select_panelist ON public.concept_tests;
CREATE POLICY concept_tests_select_panelist ON public.concept_tests FOR SELECT TO authenticated
USING (
  public.is_active_user() AND status = 'active'
  AND assigned_panelist_ids @> ARRAY[auth.uid()::text]
  AND public.panelist_is_eligible_for_sample(auth.uid(), NULL, formulation_version_id)
);

DROP POLICY IF EXISTS responses_insert_own ON public.responses;
CREATE POLICY responses_insert_own ON public.responses FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user() AND auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'active'
      AND p.assigned_panelist_ids @> ARRAY[auth.uid()::text]
      AND public.panelist_is_eligible_for_sample(auth.uid(), p.id, NULL)
  )
);

DROP POLICY IF EXISTS concept_responses_insert_own ON public.concept_responses;
CREATE POLICY concept_responses_insert_own ON public.concept_responses FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user() AND auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.concept_tests ct WHERE ct.id = concept_test_id AND ct.status = 'active'
      AND ct.assigned_panelist_ids @> ARRAY[auth.uid()::text]
      AND public.panelist_is_eligible_for_sample(auth.uid(), NULL, ct.formulation_version_id)
  )
);

CREATE FUNCTION public.capture_response_demographic_snapshot()
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
    org_id, panelist_id, response_id, concept_response_id, age_band, gender, region,
    household_size, children_in_household, dietary_pattern, grocery_role,
    category_usage_frequency, captured_at
  ) VALUES (
    v_profile.org_id, NEW.user_id,
    CASE WHEN TG_TABLE_NAME = 'responses' THEN NEW.id ELSE NULL END,
    CASE WHEN TG_TABLE_NAME = 'concept_responses' THEN NEW.id ELSE NULL END,
    CASE WHEN v_age < 25 THEN '18–24' WHEN v_age < 35 THEN '25–34'
      WHEN v_age < 45 THEN '35–44' WHEN v_age < 55 THEN '45–54'
      WHEN v_age < 65 THEN '55–64' ELSE '65+' END,
    v_eligibility.gender, v_profile.region, v_eligibility.household_size,
    v_eligibility.children_in_household, v_eligibility.dietary_pattern,
    v_eligibility.grocery_role, v_eligibility.category_usage_frequency,
    COALESCE(NEW.created_at, now())
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_response_demographic_snapshot ON public.responses;
CREATE TRIGGER trg_response_demographic_snapshot AFTER INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.capture_response_demographic_snapshot();
DROP TRIGGER IF EXISTS trg_concept_response_demographic_snapshot ON public.concept_responses;
CREATE TRIGGER trg_concept_response_demographic_snapshot AFTER INSERT ON public.concept_responses
  FOR EACH ROW EXECUTE FUNCTION public.capture_response_demographic_snapshot();
