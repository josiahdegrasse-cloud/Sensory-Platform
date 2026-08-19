-- Enforce the reviewed Draft -> Active study launch boundary in the database.
-- Drafts may be incomplete; an active study must be safe and field-ready.

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.assert_product_study_launch_ready()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_panelist_id text;
  v_sample_count integer;
  v_sample_code_count integer;
  v_sample_label_count integer;
BEGIN
  IF NEW.status <> 'active' THEN
    RETURN NEW;
  END IF;

  IF btrim(COALESCE(NEW.name, '')) = '' THEN
    RAISE EXCEPTION 'Add a study name before launch';
  END IF;

  IF btrim(COALESCE(NEW.category, '')) = '' THEN
    RAISE EXCEPTION 'Add a food type or category before launch';
  END IF;

  IF cardinality(COALESCE(NEW.survey_sections, ARRAY[]::text[])) = 0 THEN
    RAISE EXCEPTION 'Select at least one questionnaire section before launch';
  END IF;

  IF NEW.survey_sections @> ARRAY['cata']::text[] AND (
    NEW.custom_attributes IS NULL
    OR jsonb_typeof(NEW.custom_attributes) <> 'array'
    OR jsonb_array_length(NEW.custom_attributes) = 0
  ) THEN
    RAISE EXCEPTION 'Select at least one CATA attribute before launch';
  END IF;

  IF cardinality(COALESCE(NEW.assigned_panelist_ids, ARRAY[]::text[])) = 0 THEN
    RAISE EXCEPTION 'Assign at least one eligible panelist before launch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sample_allergen_declarations d
    WHERE d.product_id = NEW.id
      AND d.is_current
      AND d.status = 'verified'
  ) THEN
    RAISE EXCEPTION 'Verify the exact-sample allergen declaration before launch';
  END IF;

  FOREACH v_panelist_id IN ARRAY COALESCE(NEW.assigned_panelist_ids, ARRAY[]::text[]) LOOP
    IF NOT public.panelist_is_eligible_for_sample(v_panelist_id::uuid, NEW.id, NULL) THEN
      RAISE EXCEPTION 'Every assigned panelist must remain eligible at launch';
    END IF;
  END LOOP;

  IF COALESCE(NEW.is_multi_sample, false) THEN
    IF NEW.samples IS NULL OR jsonb_typeof(NEW.samples) <> 'array' THEN
      RAISE EXCEPTION 'Configure exactly three coded servings before launching a triangle test';
    END IF;

    SELECT
      count(*),
      count(DISTINCT NULLIF(btrim(sample ->> 'code'), '')),
      count(DISTINCT NULLIF(btrim(sample ->> 'label'), ''))
    INTO v_sample_count, v_sample_code_count, v_sample_label_count
    FROM jsonb_array_elements(NEW.samples) AS item(sample);

    IF v_sample_count <> 3 OR v_sample_code_count <> 3 OR v_sample_label_count <> 2 THEN
      RAISE EXCEPTION 'Triangle tests require three unique codes for exactly two underlying samples';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.assert_product_study_launch_ready() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_products_launch_ready ON public.products;
CREATE TRIGGER trg_products_launch_ready
  BEFORE INSERT OR UPDATE OF status ON public.products
  FOR EACH ROW
  WHEN (NEW.status = 'active')
  EXECUTE FUNCTION private.assert_product_study_launch_ready();

COMMENT ON FUNCTION private.assert_product_study_launch_ready() IS
  'Prevents product studies becoming active until questionnaire, exact-sample safety, and eligible panel assignment requirements are satisfied.';
