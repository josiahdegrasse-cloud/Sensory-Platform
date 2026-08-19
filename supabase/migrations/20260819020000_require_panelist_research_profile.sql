-- A panelist must finish the research-profile and safety onboarding before
-- becoming eligible for study assignment or tasting-box creation.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.assert_panelist_research_profile_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ready boolean;
BEGIN
  IF NEW.role <> 'panelist' OR NEW.eligibility_completed_at IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.panelist_eligibility_profiles e
    WHERE e.panelist_id = NEW.id
      AND e.org_id = NEW.org_id
      AND e.gender IS NOT NULL
      AND e.dietary_pattern IS NOT NULL
      AND e.grocery_role IS NOT NULL
      AND e.category_usage_frequency IS NOT NULL
  ) INTO v_ready;

  IF NOT v_ready THEN
    RAISE EXCEPTION 'Complete the required research profile before joining a study';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_panelist_research_profile_ready() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_profiles_research_profile_ready ON public.profiles;
CREATE TRIGGER trg_profiles_research_profile_ready
  BEFORE INSERT OR UPDATE OF eligibility_completed_at ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.assert_panelist_research_profile_ready();

-- Existing accounts that skipped the formerly optional research questions
-- return to onboarding and immediately stop qualifying for study access.
UPDATE public.profiles p
SET eligibility_completed_at = NULL
FROM public.panelist_eligibility_profiles e
WHERE p.id = e.panelist_id
  AND p.org_id = e.org_id
  AND p.role = 'panelist'
  AND p.eligibility_completed_at IS NOT NULL
  AND (
    e.gender IS NULL
    OR e.dietary_pattern IS NULL
    OR e.grocery_role IS NULL
    OR e.category_usage_frequency IS NULL
  );

-- Keep administrator rosters aligned with the same gate. Panelist-facing RLS
-- already denies access immediately; this also removes stale UI assignments.
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

COMMENT ON FUNCTION private.assert_panelist_research_profile_ready() IS
  'Prevents a panelist from completing eligibility onboarding until required research-profile selections are recorded.';
