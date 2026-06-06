CREATE TABLE IF NOT EXISTS public.commercialization_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_record_id uuid NOT NULL REFERENCES public.decision_records(id) ON DELETE RESTRICT,
  concept_test_id uuid NOT NULL REFERENCES public.concept_tests(id) ON DELETE RESTRICT,
  packaging_image_id uuid REFERENCES public.concept_images(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  title text NOT NULL,
  report_snapshot jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (decision_record_id, concept_test_id, version)
);

CREATE INDEX IF NOT EXISTS idx_commercialization_reports_decision
  ON public.commercialization_reports(decision_record_id);
CREATE INDEX IF NOT EXISTS idx_commercialization_reports_concept
  ON public.commercialization_reports(concept_test_id);

ALTER TABLE public.commercialization_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercialization_reports_admin_select ON public.commercialization_reports;
CREATE POLICY commercialization_reports_admin_select ON public.commercialization_reports
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS commercialization_reports_admin_insert ON public.commercialization_reports;
CREATE POLICY commercialization_reports_admin_insert ON public.commercialization_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS commercialization_reports_admin_update ON public.commercialization_reports;
CREATE POLICY commercialization_reports_admin_update ON public.commercialization_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (
    public.is_admin()
    AND (
      status <> 'approved'
      OR (approved_by = auth.uid() AND approved_at IS NOT NULL)
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.commercialization_reports TO authenticated;

CREATE OR REPLACE FUNCTION public.create_commercialization_report(
  target_decision_record_id uuid,
  target_concept_test_id uuid,
  target_packaging_image_id uuid,
  target_title text,
  target_report_snapshot jsonb
)
RETURNS public.commercialization_reports
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  next_version integer;
  created_report public.commercialization_reports;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can create commercialization reports';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.decision_records
    WHERE id = target_decision_record_id AND decision = 'GO'
  ) THEN
    RAISE EXCEPTION 'A confirmed GO decision is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.concept_tests WHERE id = target_concept_test_id
  ) THEN
    RAISE EXCEPTION 'Concept study not found';
  END IF;
  IF target_packaging_image_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.concept_images
    WHERE id = target_packaging_image_id
      AND concept_test_id = target_concept_test_id
  ) THEN
    RAISE EXCEPTION 'Packaging image does not belong to the selected concept study';
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
    title,
    report_snapshot,
    created_by,
    version
  )
  VALUES (
    target_decision_record_id,
    target_concept_test_id,
    target_packaging_image_id,
    target_title,
    target_report_snapshot,
    auth.uid(),
    next_version
  )
  RETURNING * INTO created_report;

  RETURN created_report;
END;
$$;

REVOKE ALL ON FUNCTION public.create_commercialization_report(uuid, uuid, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commercialization_report(uuid, uuid, uuid, text, jsonb) TO authenticated;
