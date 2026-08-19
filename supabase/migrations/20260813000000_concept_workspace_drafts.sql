-- Durable Concept Lab work-in-progress state.
--
-- A workspace draft is not a concept test and must not appear in Studies until
-- launch. It is anchored to one confirmed decision + evidence bundle and is
-- tenant-scoped through the same org model as the rest of the platform.

CREATE TABLE public.concept_workspace_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  decision_record_id uuid NOT NULL REFERENCES public.decision_records(id) ON DELETE RESTRICT,
  evidence_bundle_id uuid NOT NULL REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  formulation_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  current_step text NOT NULL DEFAULT 'concept'
    CHECK (current_step IN ('concept', 'survey', 'panel', 'review')),
  draft_payload jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(draft_payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, project_id, decision_record_id)
);

CREATE INDEX idx_concept_workspace_drafts_project
  ON public.concept_workspace_drafts(org_id, project_id, updated_at DESC);

DROP TRIGGER IF EXISTS trg_set_org_id ON public.concept_workspace_drafts;
CREATE TRIGGER trg_set_org_id
  BEFORE INSERT ON public.concept_workspace_drafts
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

CREATE OR REPLACE FUNCTION public.touch_concept_workspace_draft()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_concept_workspace_draft
  BEFORE UPDATE ON public.concept_workspace_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_concept_workspace_draft();

ALTER TABLE public.concept_workspace_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY concept_workspace_drafts_admin_all
  ON public.concept_workspace_drafts
  FOR ALL TO authenticated
  USING (
    public.is_active_user()
    AND public.is_admin()
    AND org_id = public.current_org_id()
  )
  WITH CHECK (
    public.is_active_user()
    AND public.is_admin()
    AND org_id = public.current_org_id()
    AND created_by = auth.uid()
  );

COMMENT ON TABLE public.concept_workspace_drafts IS
  'Durable, tenant-scoped Concept Lab wizard drafts anchored to confirmed GO evidence.';
COMMENT ON COLUMN public.concept_workspace_drafts.draft_payload IS
  'Versioned Concept Lab wizard state; authoritative lineage remains in typed FK columns.';
