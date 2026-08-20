-- An externally released cover must trace through governed re-staging steps to
-- a real uploaded product photograph. A non-null parent id alone is not enough:
-- it could otherwise point to a text-generated concept visual.

CREATE OR REPLACE FUNCTION public.validate_concept_image_asset_governance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_asset public.concept_images%ROWTYPE;
  qa_key text;
  lineage_has_uploaded_reference boolean := false;
  lineage_has_text_generated boolean := false;
  lineage_has_cycle boolean := false;
  lineage_exceeds_limit boolean := false;
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

    WITH RECURSIVE lineage AS (
      SELECT
        parent_asset.id,
        parent_asset.parent_image_id,
        parent_asset.source_kind,
        ARRAY[parent_asset.id]::uuid[] AS path,
        false AS cycle,
        1 AS depth
      UNION ALL
      SELECT
        ancestor.id,
        ancestor.parent_image_id,
        ancestor.source_kind,
        lineage.path || ancestor.id,
        ancestor.id = ANY(lineage.path),
        lineage.depth + 1
      FROM lineage
      JOIN public.concept_images AS ancestor
        ON ancestor.id = lineage.parent_image_id
       AND ancestor.org_id = NEW.org_id
      WHERE NOT lineage.cycle
        AND lineage.depth < 16
    )
    SELECT
      COALESCE(bool_or(source_kind = 'uploaded_reference'), false),
      COALESCE(bool_or(source_kind = 'text_generated'), false),
      COALESCE(bool_or(cycle), false),
      COALESCE(bool_or(depth = 16 AND parent_image_id IS NOT NULL), false)
    INTO
      lineage_has_uploaded_reference,
      lineage_has_text_generated,
      lineage_has_cycle,
      lineage_exceeds_limit
    FROM lineage;

    IF NOT lineage_has_uploaded_reference
       OR lineage_has_text_generated
       OR lineage_has_cycle
       OR lineage_exceeds_limit THEN
      RAISE EXCEPTION 'The report cover is not traceable to a real uploaded product reference';
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
