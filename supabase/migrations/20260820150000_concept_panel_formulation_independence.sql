-- Concept studies present visual and written stimuli; they do not serve or ship
-- a food sample. Keep adult/current-profile safeguards, but do not require an
-- exact formulation or apply formulation-allergen matching to concept access.

CREATE OR REPLACE FUNCTION public.panelist_is_ready_for_concept(
  p_panelist_id uuid
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
    JOIN public.panelist_eligibility_profiles e
      ON e.panelist_id = p.id
      AND e.org_id = p.org_id
    WHERE p.id = p_panelist_id
      AND p.org_id = public.current_org_id()
      AND p.role = 'panelist'
      AND p.status = 'active'
      AND p.profile_completed_at IS NOT NULL
      AND p.eligibility_completed_at IS NOT NULL
      AND e.adult_confirmed_at IS NOT NULL
      AND e.declaration_expires_at >= now()
      AND (make_date(e.birth_year, e.birth_month, 1) + interval '1 month - 1 day')::date
        <= (current_date - interval '18 years')::date
  );
$$;

REVOKE ALL ON FUNCTION public.panelist_is_ready_for_concept(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.panelist_is_ready_for_concept(uuid) TO authenticated;

COMMENT ON FUNCTION public.panelist_is_ready_for_concept(uuid) IS
  'Returns whether an adult panelist in the current workspace has an active account and current completed research profile; concept studies do not require sample-allergen matching.';

CREATE OR REPLACE FUNCTION public.list_concept_ready_panelists()
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
  JOIN public.panelist_eligibility_profiles e
    ON e.panelist_id = p.id
    AND e.org_id = p.org_id
  WHERE public.is_admin()
    AND p.org_id = public.current_org_id()
    AND public.panelist_is_ready_for_concept(p.id)
  ORDER BY p.name;
$$;

REVOKE ALL ON FUNCTION public.list_concept_ready_panelists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_concept_ready_panelists() TO authenticated;

COMMENT ON FUNCTION public.list_concept_ready_panelists() IS
  'Lists the current workspace adults who may receive a concept-only study, independent of product or formulation allergen declarations.';

CREATE OR REPLACE FUNCTION public.assert_safe_sample_assignment()
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
      IF NOT public.panelist_is_ready_for_concept(v_panelist::uuid) THEN
        RAISE EXCEPTION 'A selected panelist does not have a current concept-research profile';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS concept_tests_select_panelist ON public.concept_tests;
CREATE POLICY concept_tests_select_panelist ON public.concept_tests FOR SELECT TO authenticated
USING (
  public.is_active_user()
  AND status = 'active'
  AND assigned_panelist_ids @> ARRAY[auth.uid()::text]
  AND public.panelist_is_ready_for_concept(auth.uid())
);

DROP POLICY IF EXISTS concept_responses_insert_own ON public.concept_responses;
CREATE POLICY concept_responses_insert_own ON public.concept_responses FOR INSERT TO authenticated
WITH CHECK (
  public.is_active_user()
  AND auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.concept_tests ct
    WHERE ct.id = concept_test_id
      AND ct.status = 'active'
      AND ct.assigned_panelist_ids @> ARRAY[auth.uid()::text]
      AND public.panelist_is_ready_for_concept(auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.prune_assignments_after_sample_declaration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.product_id IS NOT NULL THEN
    UPDATE public.products p
    SET assigned_panelist_ids = CASE
      WHEN NEW.status <> 'verified' THEN ARRAY[]::text[]
      ELSE COALESCE((
        SELECT array_agg(panelist_id)
        FROM unnest(COALESCE(p.assigned_panelist_ids, ARRAY[]::text[])) AS assigned(panelist_id)
        WHERE public.panelist_is_eligible_for_sample(assigned.panelist_id::uuid, p.id, NULL)
      ), ARRAY[]::text[])
    END
    WHERE p.id = NEW.product_id
      AND p.org_id = NEW.org_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prune_assignments_after_panelist_declaration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.products p
  SET assigned_panelist_ids = array_remove(p.assigned_panelist_ids, NEW.panelist_id::text)
  WHERE p.org_id = NEW.org_id
    AND p.assigned_panelist_ids @> ARRAY[NEW.panelist_id::text]
    AND NOT public.panelist_is_eligible_for_sample(NEW.panelist_id, p.id, NULL);

  UPDATE public.concept_tests ct
  SET assigned_panelist_ids = array_remove(ct.assigned_panelist_ids, NEW.panelist_id::text)
  WHERE ct.org_id = NEW.org_id
    AND ct.assigned_panelist_ids @> ARRAY[NEW.panelist_id::text]
    AND NOT public.panelist_is_ready_for_concept(NEW.panelist_id);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assert_safe_sample_assignment() IS
  'Enforces exact-sample allergen eligibility for tasting products and current adult research-profile readiness for concept-only studies.';
