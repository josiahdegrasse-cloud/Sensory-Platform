CREATE TABLE IF NOT EXISTS public.evidence_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  schema_version text NOT NULL,
  source_data_version text NOT NULL,
  payload jsonb NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT,
  UNIQUE (project_id, version),
  UNIQUE (project_id, source_data_version)
);

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_project
  ON public.evidence_bundles(project_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_bundles_source_data
  ON public.evidence_bundles(project_id, source_data_version);
CREATE INDEX IF NOT EXISTS idx_evidence_bundles_org
  ON public.evidence_bundles(org_id);

ALTER TABLE public.evidence_bundles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_set_org_id ON public.evidence_bundles;
CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

DROP POLICY IF EXISTS evidence_bundles_admin_select ON public.evidence_bundles;
CREATE POLICY evidence_bundles_admin_select ON public.evidence_bundles
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS evidence_bundles_admin_insert ON public.evidence_bundles;
CREATE POLICY evidence_bundles_admin_insert ON public.evidence_bundles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

DROP POLICY IF EXISTS evidence_bundles_org_isolation ON public.evidence_bundles;
CREATE POLICY evidence_bundles_org_isolation ON public.evidence_bundles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

GRANT SELECT, INSERT ON public.evidence_bundles TO authenticated;

ALTER TABLE public.commercialization_reports
  ADD COLUMN IF NOT EXISTS evidence_bundle_id uuid REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_commercialization_reports_evidence_bundle
  ON public.commercialization_reports(evidence_bundle_id);

CREATE OR REPLACE FUNCTION public.create_evidence_bundle(
  target_project_id text,
  target_schema_version text,
  target_source_data_version text,
  target_payload jsonb
)
RETURNS public.evidence_bundles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_bundle public.evidence_bundles;
  next_version integer;
  created_bundle public.evidence_bundles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can create evidence bundles';
  END IF;

  IF NULLIF(trim(target_project_id), '') IS NULL THEN
    RAISE EXCEPTION 'Project id is required';
  END IF;

  SELECT *
  INTO existing_bundle
  FROM public.evidence_bundles
  WHERE project_id = target_project_id
    AND source_data_version = target_source_data_version
    AND org_id = public.current_org_id()
  LIMIT 1;

  IF FOUND THEN
    RETURN existing_bundle;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('evidence-bundle:' || public.current_org_id()::text || ':' || target_project_id, 0)
  );

  SELECT COALESCE(MAX(version), 0) + 1
  INTO next_version
  FROM public.evidence_bundles
  WHERE project_id = target_project_id
    AND org_id = public.current_org_id();

  INSERT INTO public.evidence_bundles (
    project_id,
    version,
    schema_version,
    source_data_version,
    payload,
    created_by,
    org_id
  )
  VALUES (
    target_project_id,
    next_version,
    target_schema_version,
    target_source_data_version,
    target_payload,
    auth.uid(),
    public.current_org_id()
  )
  RETURNING * INTO created_bundle;

  RETURN created_bundle;
END;
$$;

REVOKE ALL ON FUNCTION public.create_evidence_bundle(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_evidence_bundle(text, text, text, jsonb) TO authenticated;
