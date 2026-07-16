-- Versioned formulation profiles turn exact ingredient statements into
-- reviewable, reusable project evidence without replacing the supplied wording.

CREATE TABLE public.formulation_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  instrumental_sample_id uuid NOT NULL REFERENCES public.instrumental_samples(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  previous_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE SET NULL,
  version_number integer NOT NULL CHECK (version_number > 0),
  exact_statement text NOT NULL CHECK (char_length(exact_statement) BETWEEN 1 AND 10000),
  statement_source text NOT NULL CHECK (statement_source IN ('csv_import', 'manual')),
  fingerprint text NOT NULL CHECK (char_length(fingerprint) = 32),
  is_current boolean NOT NULL DEFAULT true,
  review_status text NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN ('pending_review', 'reviewed', 'needs_revision')),
  change_summary text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrumental_sample_id, version_number)
);

CREATE UNIQUE INDEX uq_formulation_versions_current
  ON public.formulation_versions(instrumental_sample_id)
  WHERE is_current;
CREATE INDEX idx_formulation_versions_project
  ON public.formulation_versions(project_id, is_current);
CREATE INDEX idx_formulation_versions_org
  ON public.formulation_versions(org_id);
CREATE INDEX idx_formulation_versions_fingerprint
  ON public.formulation_versions(fingerprint);

CREATE TABLE public.formulation_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  formulation_version_id uuid NOT NULL REFERENCES public.formulation_versions(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  supplied_name text NOT NULL CHECK (char_length(trim(supplied_name)) > 0),
  canonical_name text,
  functional_role text,
  percentage numeric CHECK (percentage IS NULL OR (percentage >= 0 AND percentage <= 100)),
  supplier text,
  specification text,
  allergen_tags text[] NOT NULL DEFAULT '{}',
  dietary_tags text[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  review_status text NOT NULL DEFAULT 'suggested'
    CHECK (review_status IN ('suggested', 'verified', 'rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formulation_version_id, position)
);

CREATE INDEX idx_formulation_ingredients_version
  ON public.formulation_ingredients(formulation_version_id, position);
CREATE INDEX idx_formulation_ingredients_org
  ON public.formulation_ingredients(org_id);
CREATE INDEX idx_formulation_ingredients_canonical_name
  ON public.formulation_ingredients(lower(canonical_name));
CREATE INDEX idx_formulation_ingredients_allergens
  ON public.formulation_ingredients USING gin(allergen_tags);
CREATE INDEX idx_formulation_ingredients_dietary
  ON public.formulation_ingredients USING gin(dietary_tags);

ALTER TABLE public.decision_records
  ADD COLUMN formulation_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE SET NULL;
ALTER TABLE public.concept_tests
  ADD COLUMN formulation_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE SET NULL;
ALTER TABLE public.commercialization_reports
  ADD COLUMN formulation_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE SET NULL;

CREATE INDEX idx_decision_records_formulation_version
  ON public.decision_records(formulation_version_id);
CREATE INDEX idx_concept_tests_formulation_version
  ON public.concept_tests(formulation_version_id);
CREATE INDEX idx_commercialization_reports_formulation_version
  ON public.commercialization_reports(formulation_version_id);

ALTER TABLE public.formulation_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulation_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY formulation_versions_admin_all ON public.formulation_versions
  FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin() AND org_id = public.current_org_id());

CREATE POLICY formulation_ingredients_admin_all ON public.formulation_ingredients
  FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin() AND org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulation_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulation_ingredients TO authenticated;

-- Preserve current statements as version 1. Structured rows remain empty until
-- an admin reviews or re-saves the statement through the application parser.
INSERT INTO public.formulation_versions (
  org_id,
  instrumental_sample_id,
  project_id,
  version_number,
  exact_statement,
  statement_source,
  fingerprint,
  is_current,
  review_status,
  created_at,
  updated_at
)
SELECT
  s.org_id,
  s.id,
  s.project_id,
  1,
  trim(s.ingredient_statement),
  CASE WHEN s.ingredient_statement_source = 'manual' THEN 'manual' ELSE 'csv_import' END,
  md5(trim(s.ingredient_statement)),
  true,
  'pending_review',
  COALESCE(s.ingredient_statement_updated_at, s.created_at),
  COALESCE(s.ingredient_statement_updated_at, s.created_at)
FROM public.instrumental_samples s
WHERE s.org_id IS NOT NULL
  AND nullif(trim(s.ingredient_statement), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.formulation_versions existing
    WHERE existing.instrumental_sample_id = s.id
  );

CREATE OR REPLACE FUNCTION public.set_formulation_profile(
  target_import_batch_id uuid,
  target_sample_id text,
  target_statement text,
  target_source text DEFAULT 'manual',
  target_ingredients jsonb DEFAULT '[]'::jsonb,
  target_change_summary text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_sample public.instrumental_samples%ROWTYPE;
  v_previous public.formulation_versions%ROWTYPE;
  v_version public.formulation_versions%ROWTYPE;
  v_statement text := nullif(trim(target_statement), '');
  v_item jsonb;
  v_percentage numeric;
  v_confidence numeric;
  v_position integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can update formulation profiles';
  END IF;
  IF target_source NOT IN ('csv_import', 'manual') THEN
    RAISE EXCEPTION 'Unsupported ingredient statement source';
  END IF;
  IF target_ingredients IS NULL OR jsonb_typeof(target_ingredients) <> 'array' THEN
    RAISE EXCEPTION 'Structured ingredients must be a JSON array';
  END IF;

  SELECT * INTO v_sample
  FROM public.instrumental_samples
  WHERE import_batch_id = target_import_batch_id
    AND sample_id = target_sample_id
    AND org_id = public.current_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected product could not be found in this import batch';
  END IF;

  SELECT * INTO v_previous
  FROM public.formulation_versions
  WHERE instrumental_sample_id = v_sample.id AND is_current
  FOR UPDATE;

  IF v_statement IS NULL THEN
    UPDATE public.formulation_versions
    SET is_current = false, updated_at = now()
    WHERE instrumental_sample_id = v_sample.id AND is_current;

    UPDATE public.instrumental_samples
    SET ingredient_statement = NULL,
        ingredient_statement_source = 'not_provided',
        ingredient_statement_updated_at = now()
    WHERE id = v_sample.id;
    RETURN NULL;
  END IF;

  IF v_previous.id IS NOT NULL
     AND v_previous.fingerprint = md5(v_statement)
     AND v_previous.exact_statement = v_statement THEN
    DELETE FROM public.formulation_ingredients
    WHERE formulation_version_id = v_previous.id;
    v_version := v_previous;
  ELSE
    UPDATE public.formulation_versions
    SET is_current = false, updated_at = now()
    WHERE instrumental_sample_id = v_sample.id AND is_current;

    INSERT INTO public.formulation_versions (
      org_id, instrumental_sample_id, project_id, previous_version_id,
      version_number, exact_statement, statement_source, fingerprint,
      is_current, review_status, change_summary, created_by
    ) VALUES (
      v_sample.org_id, v_sample.id, v_sample.project_id, v_previous.id,
      COALESCE(v_previous.version_number, 0) + 1, v_statement, target_source,
      md5(v_statement), true, 'pending_review', nullif(trim(target_change_summary), ''), auth.uid()
    ) RETURNING * INTO v_version;
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(target_ingredients)
  LOOP
    v_position := v_position + 1;
    v_percentage := CASE
      WHEN nullif(v_item->>'percentage', '') IS NULL THEN NULL
      ELSE (v_item->>'percentage')::numeric
    END;
    v_confidence := COALESCE((v_item->>'confidence')::numeric, 0);

    INSERT INTO public.formulation_ingredients (
      org_id, formulation_version_id, position, supplied_name, canonical_name,
      functional_role, percentage, supplier, specification, allergen_tags,
      dietary_tags, confidence, review_status, notes
    ) VALUES (
      v_sample.org_id,
      v_version.id,
      COALESCE((v_item->>'position')::integer, v_position),
      trim(v_item->>'suppliedName'),
      nullif(trim(v_item->>'canonicalName'), ''),
      nullif(trim(v_item->>'functionalRole'), ''),
      v_percentage,
      nullif(trim(v_item->>'supplier'), ''),
      nullif(trim(v_item->>'specification'), ''),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_item->'allergenTags')), '{}'),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(v_item->'dietaryTags')), '{}'),
      v_confidence,
      CASE WHEN v_item->>'reviewStatus' IN ('suggested', 'verified', 'rejected')
        THEN v_item->>'reviewStatus' ELSE 'suggested' END,
      nullif(trim(v_item->>'notes'), '')
    );
  END LOOP;

  UPDATE public.instrumental_samples
  SET ingredient_statement = v_statement,
      ingredient_statement_source = target_source,
      ingredient_statement_updated_at = now()
  WHERE id = v_sample.id;

  RETURN v_version.id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_formulation_profile(uuid, text, text, text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_formulation_profile(uuid, text, text, text, jsonb, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_formulation_version(
  target_version_id uuid,
  target_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can review formulations';
  END IF;
  IF target_status NOT IN ('reviewed', 'needs_revision') THEN
    RAISE EXCEPTION 'Unsupported formulation review status';
  END IF;

  UPDATE public.formulation_versions
  SET review_status = target_status,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_at = now()
  WHERE id = target_version_id
    AND org_id = public.current_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulation version not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.review_formulation_version(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_formulation_version(uuid, text) TO authenticated;

COMMENT ON TABLE public.formulation_versions IS
  'Immutable formulation snapshots. The exact supplied ingredient statement remains authoritative.';
COMMENT ON TABLE public.formulation_ingredients IS
  'Reviewable structured ingredient candidates derived from an exact formulation statement.';
COMMENT ON COLUMN public.formulation_ingredients.percentage IS
  'An explicit supplied percentage only. The application must never infer missing quantities.';
COMMENT ON COLUMN public.formulation_ingredients.allergen_tags IS
  'Suggested or verified allergen tags. Only rows with review_status=verified may drive safety instructions.';
