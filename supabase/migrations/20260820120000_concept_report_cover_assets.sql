-- Governed product-truth and client-report cover assets.
--
-- A panelist stimulus, an approved representation of the physical food, and a
-- client-report cover are different records with different release rules. The
-- schema owns those roles so report code never has to infer them from a URL or
-- an array position.

ALTER TABLE public.concept_images
  ADD COLUMN IF NOT EXISTS asset_role text NOT NULL DEFAULT 'concept_visual'
    CHECK (asset_role IN (
      'concept_visual',
      'panelist_stimulus',
      'product_reference',
      'product_truth',
      'report_cover'
    )),
  ADD COLUMN IF NOT EXISTS parent_image_id uuid
    REFERENCES public.concept_images(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT 'text_generated'
    CHECK (source_kind IN ('uploaded_reference', 'reference_generated', 'text_generated')),
  ADD COLUMN IF NOT EXISTS approved_for_external_use boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS external_approved_by uuid
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS external_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS quality_scores jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS focal_x numeric(5, 4) NOT NULL DEFAULT 0.5
    CHECK (focal_x BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS focal_y numeric(5, 4) NOT NULL DEFAULT 0.5
    CHECK (focal_y BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS safe_area jsonb NOT NULL DEFAULT
    '{"top":0.08,"right":0.08,"bottom":0.08,"left":0.08}'::jsonb;

ALTER TABLE public.concept_tests
  ADD COLUMN IF NOT EXISTS product_truth_image_id uuid
    REFERENCES public.concept_images(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS report_cover_image_id uuid
    REFERENCES public.concept_images(id) ON DELETE SET NULL;

ALTER TABLE public.commercialization_reports
  ADD COLUMN IF NOT EXISTS cover_image_id uuid
    REFERENCES public.concept_images(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_concept_images_asset_role
  ON public.concept_images (org_id, asset_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_concept_images_parent
  ON public.concept_images (parent_image_id)
  WHERE parent_image_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_concept_tests_product_truth
  ON public.concept_tests (product_truth_image_id)
  WHERE product_truth_image_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_concept_tests_report_cover
  ON public.concept_tests (report_cover_image_id)
  WHERE report_cover_image_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_commercialization_reports_cover
  ON public.commercialization_reports (cover_image_id)
  WHERE cover_image_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_concept_image_asset_governance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_asset public.concept_images%ROWTYPE;
  qa_key text;
  required_cover_scores constant text[] := ARRAY[
    'shapeAccuracy',
    'colorAccuracy',
    'surfaceTexture',
    'interiorAccuracy',
    'scaleAccuracy',
    'servingContext',
    'brandAlignment',
    'coverSafeArea'
  ];
BEGIN
  IF NEW.parent_image_id IS NOT NULL THEN
    SELECT *
    INTO parent_asset
    FROM public.concept_images
    WHERE id = NEW.parent_image_id;

    IF NOT FOUND OR parent_asset.org_id IS DISTINCT FROM NEW.org_id THEN
      RAISE EXCEPTION 'The parent image does not belong to this organization';
    END IF;
  END IF;

  IF NEW.asset_role = 'report_cover' AND NEW.parent_image_id IS NULL THEN
    RAISE EXCEPTION 'A report cover must be generated from a governed product reference';
  END IF;

  IF NEW.approved_for_external_use THEN
    IF NEW.asset_role <> 'report_cover' THEN
      RAISE EXCEPTION 'Only report-cover assets can be approved for external use';
    END IF;
    IF NEW.external_approved_by IS NULL OR NEW.external_approved_at IS NULL THEN
      RAISE EXCEPTION 'External approval requires an approver and approval timestamp';
    END IF;
    IF NEW.external_approved_by IS DISTINCT FROM auth.uid() OR NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = NEW.external_approved_by
        AND org_id = NEW.org_id
        AND role = 'admin'
        AND status = 'active'
    ) THEN
      RAISE EXCEPTION 'External approval must be recorded by the active administrator';
    END IF;
    IF NEW.source_kind = 'text_generated' THEN
      RAISE EXCEPTION 'A text-only generated image cannot be approved for an external report';
    END IF;
    IF parent_asset.source_kind = 'text_generated' THEN
      RAISE EXCEPTION 'The report cover is not anchored to a real product reference';
    END IF;
    IF parent_asset.source_kind = 'reference_generated' AND parent_asset.parent_image_id IS NULL THEN
      RAISE EXCEPTION 'The product-truth image is missing its real reference lineage';
    END IF;

    FOREACH qa_key IN ARRAY required_cover_scores LOOP
      IF jsonb_typeof(NEW.quality_scores -> qa_key) <> 'number'
         OR (NEW.quality_scores ->> qa_key)::numeric < 4 THEN
        RAISE EXCEPTION 'Report cover quality score % must be at least 4', qa_key;
      END IF;
    END LOOP;
  END IF;

  IF NOT NEW.approved_for_external_use THEN
    NEW.external_approved_by := NULL;
    NEW.external_approved_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_validate_concept_image_asset_governance ON public.concept_images;
CREATE TRIGGER zz_validate_concept_image_asset_governance
  BEFORE INSERT OR UPDATE OF
    asset_role,
    parent_image_id,
    source_kind,
    approved_for_external_use,
    external_approved_by,
    external_approved_at,
    quality_scores,
    org_id
  ON public.concept_images
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_concept_image_asset_governance();

CREATE OR REPLACE FUNCTION public.validate_concept_test_report_assets()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.product_truth_image_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.concept_images
    WHERE id = NEW.product_truth_image_id
      AND org_id = NEW.org_id
      AND asset_role IN ('product_reference', 'product_truth')
  ) THEN
    RAISE EXCEPTION 'The product-truth image is not a governed product asset in this organization';
  END IF;

  IF NEW.report_cover_image_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.concept_images
    WHERE id = NEW.report_cover_image_id
      AND org_id = NEW.org_id
      AND asset_role = 'report_cover'
      AND approved_for_external_use = true
  ) THEN
    RAISE EXCEPTION 'The report cover is not approved for external use in this organization';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_validate_concept_test_report_assets ON public.concept_tests;
CREATE TRIGGER zz_validate_concept_test_report_assets
  BEFORE INSERT OR UPDATE OF product_truth_image_id, report_cover_image_id, org_id
  ON public.concept_tests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_concept_test_report_assets();

CREATE OR REPLACE FUNCTION public.validate_commercialization_report_cover()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.cover_image_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.concept_images
    WHERE id = NEW.cover_image_id
      AND org_id = NEW.org_id
      AND concept_test_id = NEW.concept_test_id
      AND asset_role = 'report_cover'
      AND approved_for_external_use = true
  ) THEN
    RAISE EXCEPTION 'The report cover is not an approved asset for the selected concept study';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_validate_commercialization_report_cover ON public.commercialization_reports;
CREATE TRIGGER zz_validate_commercialization_report_cover
  BEFORE INSERT OR UPDATE OF cover_image_id, concept_test_id, org_id
  ON public.commercialization_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_commercialization_report_cover();

DROP FUNCTION IF EXISTS public.create_commercialization_report(uuid, uuid, uuid, text, jsonb, uuid, uuid);

CREATE FUNCTION public.create_commercialization_report(
  target_decision_record_id uuid,
  target_concept_test_id uuid,
  target_packaging_image_id uuid,
  target_title text,
  target_report_snapshot jsonb,
  target_evidence_bundle_id uuid DEFAULT NULL,
  target_formulation_version_id uuid DEFAULT NULL,
  target_cover_image_id uuid DEFAULT NULL
)
RETURNS public.commercialization_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source_decision public.decision_records%ROWTYPE;
  source_concept public.concept_tests%ROWTYPE;
  freshness record;
  next_version integer;
  created_report public.commercialization_reports;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can create commercialization reports';
  END IF;

  SELECT *
  INTO source_decision
  FROM public.decision_records
  WHERE id = target_decision_record_id
    AND org_id = public.current_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decision record not found';
  END IF;

  SELECT *
  INTO freshness
  FROM public.get_decision_freshness(target_decision_record_id);

  IF NOT freshness.allowed THEN
    RAISE EXCEPTION '%', freshness.reason;
  END IF;
  IF target_evidence_bundle_id IS NOT NULL
     AND target_evidence_bundle_id <> source_decision.evidence_bundle_id THEN
    RAISE EXCEPTION 'The report evidence bundle does not match the confirmed decision';
  END IF;
  IF target_formulation_version_id IS DISTINCT FROM source_decision.formulation_version_id THEN
    RAISE EXCEPTION 'The report formulation does not match the confirmed decision';
  END IF;

  SELECT *
  INTO source_concept
  FROM public.concept_tests
  WHERE id = target_concept_test_id
    AND org_id = public.current_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Concept study not found';
  END IF;
  IF source_concept.decision_record_id IS DISTINCT FROM source_decision.id THEN
    RAISE EXCEPTION 'The selected concept study is not linked to this decision';
  END IF;
  IF target_packaging_image_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.concept_images
    WHERE id = target_packaging_image_id
      AND org_id = public.current_org_id()
      AND concept_test_id = target_concept_test_id
  ) THEN
    RAISE EXCEPTION 'Packaging image does not belong to the selected concept study';
  END IF;
  IF target_cover_image_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.concept_images
    WHERE id = target_cover_image_id
      AND org_id = public.current_org_id()
      AND concept_test_id = target_concept_test_id
      AND asset_role = 'report_cover'
      AND approved_for_external_use = true
  ) THEN
    RAISE EXCEPTION 'Report cover is not approved for the selected concept study';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_decision_record_id::text || ':' || target_concept_test_id::text, 0)
  );

  SELECT COALESCE(MAX(version), 0) + 1
  INTO next_version
  FROM public.commercialization_reports
  WHERE decision_record_id = target_decision_record_id
    AND concept_test_id = target_concept_test_id;

  INSERT INTO public.commercialization_reports (
    decision_record_id,
    concept_test_id,
    packaging_image_id,
    cover_image_id,
    evidence_bundle_id,
    formulation_version_id,
    project_id,
    title,
    report_snapshot,
    created_by,
    version
  )
  VALUES (
    source_decision.id,
    source_concept.id,
    target_packaging_image_id,
    target_cover_image_id,
    source_decision.evidence_bundle_id,
    source_decision.formulation_version_id,
    source_decision.project_id,
    target_title,
    target_report_snapshot,
    auth.uid(),
    next_version
  )
  RETURNING * INTO created_report;

  RETURN created_report;
END;
$$;

REVOKE ALL ON FUNCTION public.create_commercialization_report(uuid, uuid, uuid, text, jsonb, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commercialization_report(uuid, uuid, uuid, text, jsonb, uuid, uuid, uuid) TO authenticated;

COMMENT ON COLUMN public.concept_images.asset_role IS
  'Governed downstream use: panelist stimulus, product reference/truth, or client-report cover.';
COMMENT ON COLUMN public.concept_images.approved_for_external_use IS
  'True only after the report-cover fidelity checklist is complete and a human approver is recorded.';
COMMENT ON COLUMN public.commercialization_reports.cover_image_id IS
  'Immutable approved portrait cover asset for this report version; packaging_image_id remains the concept stimulus.';
