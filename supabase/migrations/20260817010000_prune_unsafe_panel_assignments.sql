-- Keep stored assignment arrays aligned with the safety gate whenever an
-- administrator changes an exact-sample declaration or a panelist renews their
-- own avoidance declaration. RLS already blocks access immediately; these
-- triggers also remove stale assignment state from administrator views.

CREATE FUNCTION public.prune_assignments_after_sample_declaration()
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
    WHERE p.id = NEW.product_id AND p.org_id = NEW.org_id;
  END IF;

  IF NEW.formulation_version_id IS NOT NULL THEN
    UPDATE public.concept_tests ct
    SET assigned_panelist_ids = CASE
      WHEN NEW.status <> 'verified' THEN ARRAY[]::text[]
      ELSE COALESCE((
        SELECT array_agg(panelist_id)
        FROM unnest(COALESCE(ct.assigned_panelist_ids, ARRAY[]::text[])) AS assigned(panelist_id)
        WHERE public.panelist_is_eligible_for_sample(assigned.panelist_id::uuid, NULL, ct.formulation_version_id)
      ), ARRAY[]::text[])
    END
    WHERE ct.formulation_version_id = NEW.formulation_version_id
      AND ct.org_id = NEW.org_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_sample_assignments ON public.sample_allergen_declarations;
CREATE TRIGGER trg_prune_sample_assignments
  AFTER INSERT ON public.sample_allergen_declarations
  FOR EACH ROW WHEN (NEW.is_current)
  EXECUTE FUNCTION public.prune_assignments_after_sample_declaration();

CREATE FUNCTION public.prune_assignments_after_panelist_declaration()
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
    AND NOT public.panelist_is_eligible_for_sample(NEW.panelist_id, NULL, ct.formulation_version_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prune_panelist_assignments ON public.panelist_eligibility_profiles;
CREATE TRIGGER trg_prune_panelist_assignments
  AFTER INSERT OR UPDATE OF allergen_avoidances, other_avoidances, declaration_expires_at,
    adult_confirmed_at, birth_month, birth_year
  ON public.panelist_eligibility_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prune_assignments_after_panelist_declaration();

