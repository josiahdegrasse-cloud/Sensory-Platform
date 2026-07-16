-- Canonical decision evidence, freshness governance, and guided formulation
-- experiments. Product-evidence changes invalidate downstream GO work;
-- literature refreshes remain advisory.

ALTER TABLE public.evidence_bundles
  ADD COLUMN project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN decision_record_id uuid REFERENCES public.decision_records(id) ON DELETE SET NULL,
  ADD COLUMN formulation_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE SET NULL,
  ADD COLUMN product_evidence_fingerprint text,
  ADD COLUMN literature_fingerprint text,
  ADD COLUMN literature_refreshed_at timestamptz,
  ADD COLUMN supersedes_bundle_id uuid REFERENCES public.evidence_bundles(id) ON DELETE SET NULL,
  ADD COLUMN is_current_product boolean NOT NULL DEFAULT true;

UPDATE public.evidence_bundles
SET product_evidence_fingerprint = source_data_version
WHERE product_evidence_fingerprint IS NULL;

UPDATE public.evidence_bundles eb
SET project_id = (
  SELECT sample.project_id
  FROM public.instrumental_samples sample
  WHERE sample.org_id = eb.org_id
    AND sample.sample_id = eb.sample_id
    AND sample.project_id IS NOT NULL
  ORDER BY sample.created_at DESC
  LIMIT 1
)
WHERE eb.project_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.instrumental_samples sample
    WHERE sample.org_id = eb.org_id
      AND sample.sample_id = eb.sample_id
      AND sample.project_id IS NOT NULL
  );

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY org_id, sample_id
      ORDER BY version DESC, created_at DESC, id DESC
    ) AS position
  FROM public.evidence_bundles
)
UPDATE public.evidence_bundles eb
SET is_current_product = ranked.position = 1
FROM ranked
WHERE ranked.id = eb.id;

ALTER TABLE public.evidence_bundles
  ALTER COLUMN product_evidence_fingerprint SET NOT NULL;

CREATE UNIQUE INDEX uq_evidence_bundles_current_product
  ON public.evidence_bundles(org_id, sample_id)
  WHERE is_current_product;
CREATE INDEX idx_evidence_bundles_project_current
  ON public.evidence_bundles(project_id, is_current_product, version DESC);
CREATE INDEX idx_evidence_bundles_decision
  ON public.evidence_bundles(decision_record_id);
CREATE INDEX idx_evidence_bundles_formulation
  ON public.evidence_bundles(formulation_version_id);

ALTER TABLE public.decision_records
  ADD COLUMN evidence_bundle_id uuid REFERENCES public.evidence_bundles(id) ON DELETE SET NULL,
  ADD COLUMN research_refreshed_at timestamptz,
  ADD COLUMN research_fingerprint text;

ALTER TABLE public.concept_tests
  ADD COLUMN decision_record_id uuid REFERENCES public.decision_records(id) ON DELETE RESTRICT,
  ADD COLUMN evidence_bundle_id uuid REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT;

CREATE INDEX idx_decision_records_evidence_bundle
  ON public.decision_records(evidence_bundle_id);
CREATE INDEX idx_concept_tests_decision_record
  ON public.concept_tests(decision_record_id);
CREATE INDEX idx_concept_tests_evidence_bundle
  ON public.concept_tests(evidence_bundle_id);

UPDATE public.decision_records decision
SET evidence_bundle_id = bundle.id
FROM public.evidence_bundles bundle
WHERE decision.evidence_bundle_id IS NULL
  AND bundle.org_id = decision.org_id
  AND bundle.sample_id = decision.sample_id
  AND bundle.is_current_product;

DROP FUNCTION IF EXISTS public.create_evidence_bundle(text, text, text, jsonb);

CREATE FUNCTION public.create_evidence_bundle(
  target_sample_id text,
  target_schema_version text,
  target_source_data_version text,
  target_payload jsonb,
  target_project_id uuid DEFAULT NULL,
  target_decision_record_id uuid DEFAULT NULL,
  target_formulation_version_id uuid DEFAULT NULL
)
RETURNS public.evidence_bundles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_bundle public.evidence_bundles;
  current_bundle public.evidence_bundles;
  next_version integer;
  created_bundle public.evidence_bundles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can create evidence bundles';
  END IF;
  IF NULLIF(trim(target_sample_id), '') IS NULL THEN
    RAISE EXCEPTION 'Sample id is required';
  END IF;
  IF target_project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = target_project_id AND org_id = public.current_org_id()
  ) THEN
    RAISE EXCEPTION 'Project not found in the current organization';
  END IF;
  IF target_decision_record_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.decision_records
    WHERE id = target_decision_record_id AND org_id = public.current_org_id()
  ) THEN
    RAISE EXCEPTION 'Decision record not found in the current organization';
  END IF;
  IF target_formulation_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.formulation_versions
    WHERE id = target_formulation_version_id AND org_id = public.current_org_id()
  ) THEN
    RAISE EXCEPTION 'Formulation version not found in the current organization';
  END IF;

  SELECT *
  INTO existing_bundle
  FROM public.evidence_bundles
  WHERE sample_id = target_sample_id
    AND source_data_version = target_source_data_version
    AND org_id = public.current_org_id()
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.evidence_bundles
    SET project_id = COALESCE(project_id, target_project_id),
        decision_record_id = COALESCE(decision_record_id, target_decision_record_id),
        formulation_version_id = COALESCE(formulation_version_id, target_formulation_version_id),
        product_evidence_fingerprint = target_source_data_version
    WHERE id = existing_bundle.id
    RETURNING * INTO existing_bundle;
    RETURN existing_bundle;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'evidence-bundle:' || public.current_org_id()::text || ':' || target_sample_id,
      0
    )
  );

  SELECT *
  INTO current_bundle
  FROM public.evidence_bundles
  WHERE sample_id = target_sample_id
    AND org_id = public.current_org_id()
    AND is_current_product
  FOR UPDATE;

  SELECT COALESCE(MAX(version), 0) + 1
  INTO next_version
  FROM public.evidence_bundles
  WHERE sample_id = target_sample_id
    AND org_id = public.current_org_id();

  UPDATE public.evidence_bundles
  SET is_current_product = false
  WHERE sample_id = target_sample_id
    AND org_id = public.current_org_id()
    AND is_current_product;

  INSERT INTO public.evidence_bundles (
    sample_id,
    project_id,
    decision_record_id,
    formulation_version_id,
    version,
    schema_version,
    source_data_version,
    product_evidence_fingerprint,
    payload,
    created_by,
    org_id,
    supersedes_bundle_id,
    is_current_product
  )
  VALUES (
    target_sample_id,
    target_project_id,
    target_decision_record_id,
    target_formulation_version_id,
    next_version,
    target_schema_version,
    target_source_data_version,
    target_source_data_version,
    target_payload,
    auth.uid(),
    public.current_org_id(),
    current_bundle.id,
    true
  )
  RETURNING * INTO created_bundle;

  RETURN created_bundle;
END;
$$;

REVOKE ALL ON FUNCTION public.create_evidence_bundle(text, text, text, jsonb, uuid, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_evidence_bundle(text, text, text, jsonb, uuid, uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_decision_freshness(target_decision_record_id uuid)
RETURNS TABLE (
  allowed boolean,
  reason text,
  product_evidence_current boolean,
  formulation_current boolean,
  literature_refresh_required boolean,
  current_evidence_bundle_id uuid,
  current_formulation_version_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  target_decision public.decision_records%ROWTYPE;
  current_bundle public.evidence_bundles%ROWTYPE;
  current_formulation public.formulation_versions%ROWTYPE;
  product_current boolean := false;
  formulation_matches boolean := false;
  refresh_needed boolean := false;
BEGIN
  SELECT *
  INTO target_decision
  FROM public.decision_records
  WHERE id = target_decision_record_id
    AND org_id = public.current_org_id();

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Decision record not found.', false, false, false, NULL::uuid, NULL::uuid;
    RETURN;
  END IF;

  SELECT *
  INTO current_bundle
  FROM public.evidence_bundles
  WHERE org_id = target_decision.org_id
    AND sample_id = target_decision.sample_id
    AND is_current_product
    AND (target_decision.project_id IS NULL OR project_id = target_decision.project_id)
  ORDER BY version DESC
  LIMIT 1;

  product_current := current_bundle.id IS NOT NULL
    AND target_decision.evidence_bundle_id = current_bundle.id;

  SELECT formulation.*
  INTO current_formulation
  FROM public.formulation_versions formulation
  JOIN public.instrumental_samples sample
    ON sample.id = formulation.instrumental_sample_id
  WHERE formulation.org_id = target_decision.org_id
    AND formulation.is_current
    AND sample.sample_id = target_decision.sample_id
    AND (target_decision.project_id IS NULL OR formulation.project_id = target_decision.project_id)
  ORDER BY formulation.version_number DESC
  LIMIT 1;

  formulation_matches := CASE
    WHEN current_formulation.id IS NULL THEN target_decision.formulation_version_id IS NULL
    ELSE target_decision.formulation_version_id = current_formulation.id
  END;

  refresh_needed := target_decision.research_refreshed_at IS NULL
    OR target_decision.research_refreshed_at < now() - interval '30 days';

  IF target_decision.decision <> 'GO' THEN
    RETURN QUERY SELECT
      false,
      'A confirmed GO decision is required.',
      product_current,
      formulation_matches,
      refresh_needed,
      current_bundle.id,
      current_formulation.id;
  ELSIF current_bundle.id IS NULL THEN
    RETURN QUERY SELECT
      false,
      'No canonical product-evidence bundle is available for this decision.',
      false,
      formulation_matches,
      refresh_needed,
      NULL::uuid,
      current_formulation.id;
  ELSIF NOT product_current THEN
    RETURN QUERY SELECT
      false,
      'Product evidence changed after this decision. Re-run and confirm the decision before concept or report work.',
      false,
      formulation_matches,
      refresh_needed,
      current_bundle.id,
      current_formulation.id;
  ELSIF NOT formulation_matches THEN
    RETURN QUERY SELECT
      false,
      'The current formulation differs from the formulation evaluated by this decision. Re-test and re-confirm before downstream work.',
      true,
      false,
      refresh_needed,
      current_bundle.id,
      current_formulation.id;
  ELSE
    RETURN QUERY SELECT
      true,
      CASE WHEN refresh_needed
        THEN 'Product evidence is current. Refresh literature before relying on mechanism guidance.'
        ELSE NULL
      END,
      true,
      true,
      refresh_needed,
      current_bundle.id,
      current_formulation.id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.get_decision_freshness(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_decision_freshness(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_decision_research_refreshed(
  target_decision_record_id uuid,
  target_research_fingerprint text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can update decision research state';
  END IF;

  UPDATE public.decision_records
  SET research_refreshed_at = now(),
      research_fingerprint = nullif(trim(target_research_fingerprint), '')
  WHERE id = target_decision_record_id
    AND org_id = public.current_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decision record not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_decision_research_refreshed(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_decision_research_refreshed(uuid, text) TO authenticated;

CREATE TABLE public.formulation_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  decision_record_id uuid NOT NULL REFERENCES public.decision_records(id) ON DELETE RESTRICT,
  evidence_bundle_id uuid NOT NULL REFERENCES public.evidence_bundles(id) ON DELETE RESTRICT,
  formulation_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 160),
  lifecycle text NOT NULL DEFAULT 'draft'
    CHECK (lifecycle IN ('draft', 'locked', 'fielding', 'analysis', 'confirmation', 'complete', 'cancelled')),
  measured_driver text NOT NULL CHECK (char_length(trim(measured_driver)) > 0),
  hypothesis text NOT NULL CHECK (char_length(trim(hypothesis)) > 0),
  primary_outcome text NOT NULL CHECK (char_length(trim(primary_outcome)) > 0),
  primary_scale_min numeric NOT NULL DEFAULT 0,
  primary_scale_max numeric NOT NULL DEFAULT 100,
  analysis_mode text NOT NULL DEFAULT 'independent'
    CHECK (analysis_mode IN ('paired', 'independent')),
  bootstrap_iterations integer NOT NULL DEFAULT 10000
    CHECK (bootstrap_iterations BETWEEN 1000 AND 100000),
  confidence_level numeric NOT NULL DEFAULT 0.95
    CHECK (confidence_level >= 0.8 AND confidence_level < 1),
  deterministic_seed integer NOT NULL DEFAULT 20260716,
  minimum_n integer NOT NULL DEFAULT 12 CHECK (minimum_n BETWEEN 2 AND 500),
  uncertainty_margin numeric NOT NULL DEFAULT 0 CHECK (uncertainty_margin >= 0),
  serving_protocol text NOT NULL DEFAULT '',
  storage_checkpoints jsonb NOT NULL DEFAULT '[]'::jsonb,
  advancement_gates jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis_snapshot jsonb,
  winner_arm_id uuid,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  locked_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  locked_at timestamptz,
  analyzed_at timestamptz,
  confirmation_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (primary_scale_max > primary_scale_min)
);

CREATE TABLE public.formulation_experiment_arms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  experiment_id uuid NOT NULL REFERENCES public.formulation_experiments(id) ON DELETE CASCADE,
  code text NOT NULL CHECK (code ~ '^(C0|V[1-3])$'),
  label text NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 120),
  arm_type text NOT NULL CHECK (arm_type IN ('control', 'variant')),
  mechanism text NOT NULL DEFAULT '',
  change_description text NOT NULL DEFAULT '',
  formulation_version_id uuid REFERENCES public.formulation_versions(id) ON DELETE SET NULL,
  sort_order integer NOT NULL CHECK (sort_order BETWEEN 0 AND 3),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, code),
  UNIQUE (experiment_id, sort_order),
  CHECK (
    (arm_type = 'control' AND code = 'C0' AND sort_order = 0)
    OR (arm_type = 'variant' AND code <> 'C0' AND sort_order > 0)
  )
);

ALTER TABLE public.formulation_experiments
  ADD CONSTRAINT formulation_experiments_winner_arm_fkey
  FOREIGN KEY (winner_arm_id)
  REFERENCES public.formulation_experiment_arms(id)
  ON DELETE SET NULL;

CREATE TABLE public.formulation_experiment_trials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  experiment_id uuid NOT NULL REFERENCES public.formulation_experiments(id) ON DELETE CASCADE,
  participant_key text NOT NULL CHECK (char_length(trim(participant_key)) > 0),
  session_key text NOT NULL DEFAULT '1' CHECK (char_length(trim(session_key)) > 0),
  batch_code text,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_id, participant_key, session_key)
);

CREATE TABLE public.formulation_experiment_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  experiment_id uuid NOT NULL REFERENCES public.formulation_experiments(id) ON DELETE CASCADE,
  trial_id uuid NOT NULL REFERENCES public.formulation_experiment_trials(id) ON DELETE CASCADE,
  arm_id uuid NOT NULL REFERENCES public.formulation_experiment_arms(id) ON DELETE CASCADE,
  primary_score numeric NOT NULL,
  overall_liking numeric,
  category_fit_score numeric,
  secondary_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  defect_flags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trial_id, arm_id)
);

CREATE INDEX idx_formulation_experiments_project
  ON public.formulation_experiments(project_id, created_at DESC);
CREATE INDEX idx_formulation_experiments_decision
  ON public.formulation_experiments(decision_record_id);
CREATE INDEX idx_formulation_experiment_arms_experiment
  ON public.formulation_experiment_arms(experiment_id, sort_order);
CREATE INDEX idx_formulation_experiment_trials_experiment
  ON public.formulation_experiment_trials(experiment_id, evaluated_at);
CREATE INDEX idx_formulation_experiment_evaluations_experiment
  ON public.formulation_experiment_evaluations(experiment_id, arm_id);

ALTER TABLE public.formulation_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulation_experiment_arms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulation_experiment_trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formulation_experiment_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY formulation_experiments_admin_all ON public.formulation_experiments
  FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin() AND org_id = public.current_org_id());
CREATE POLICY formulation_experiment_arms_admin_all ON public.formulation_experiment_arms
  FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin() AND org_id = public.current_org_id());
CREATE POLICY formulation_experiment_trials_admin_all ON public.formulation_experiment_trials
  FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin() AND org_id = public.current_org_id());
CREATE POLICY formulation_experiment_evaluations_admin_all ON public.formulation_experiment_evaluations
  FOR ALL TO authenticated
  USING (public.is_admin() AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin() AND org_id = public.current_org_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulation_experiments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulation_experiment_arms TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulation_experiment_trials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulation_experiment_evaluations TO authenticated;

CREATE OR REPLACE FUNCTION public.create_formulation_experiment(
  target_project_id uuid,
  target_decision_record_id uuid,
  target_name text,
  target_measured_driver text,
  target_hypothesis text,
  target_primary_outcome text,
  target_analysis_mode text DEFAULT 'independent',
  target_minimum_n integer DEFAULT 12,
  target_uncertainty_margin numeric DEFAULT 0,
  target_advancement_gates jsonb DEFAULT '[]'::jsonb
)
RETURNS public.formulation_experiments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source_decision public.decision_records%ROWTYPE;
  created_experiment public.formulation_experiments;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can create formulation experiments';
  END IF;
  IF target_analysis_mode NOT IN ('paired', 'independent') THEN
    RAISE EXCEPTION 'Unsupported analysis mode';
  END IF;
  IF jsonb_typeof(target_advancement_gates) <> 'array' THEN
    RAISE EXCEPTION 'Advancement gates must be a JSON array';
  END IF;

  SELECT *
  INTO source_decision
  FROM public.decision_records
  WHERE id = target_decision_record_id
    AND project_id = target_project_id
    AND org_id = public.current_org_id()
    AND decision IN ('TWEAK', 'STOP');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A project-scoped TWEAK or STOP decision is required';
  END IF;
  IF source_decision.evidence_bundle_id IS NULL THEN
    RAISE EXCEPTION 'The decision must be linked to a canonical evidence bundle before an experiment can be created';
  END IF;

  INSERT INTO public.formulation_experiments (
    org_id,
    project_id,
    decision_record_id,
    evidence_bundle_id,
    formulation_version_id,
    name,
    measured_driver,
    hypothesis,
    primary_outcome,
    analysis_mode,
    minimum_n,
    uncertainty_margin,
    advancement_gates,
    created_by
  )
  VALUES (
    public.current_org_id(),
    target_project_id,
    source_decision.id,
    source_decision.evidence_bundle_id,
    source_decision.formulation_version_id,
    trim(target_name),
    trim(target_measured_driver),
    trim(target_hypothesis),
    trim(target_primary_outcome),
    target_analysis_mode,
    target_minimum_n,
    target_uncertainty_margin,
    target_advancement_gates,
    auth.uid()
  )
  RETURNING * INTO created_experiment;

  INSERT INTO public.formulation_experiment_arms (
    org_id,
    experiment_id,
    code,
    label,
    arm_type,
    mechanism,
    change_description,
    formulation_version_id,
    sort_order
  )
  VALUES (
    public.current_org_id(),
    created_experiment.id,
    'C0',
    'Current control',
    'control',
    'Current formulation and process',
    'No intentional change',
    source_decision.formulation_version_id,
    0
  );

  RETURN created_experiment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_formulation_experiment(uuid, uuid, text, text, text, text, text, integer, numeric, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_formulation_experiment(uuid, uuid, text, text, text, text, text, integer, numeric, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_formulation_experiment_arm(
  target_experiment_id uuid,
  target_label text,
  target_mechanism text,
  target_change_description text
)
RETURNS public.formulation_experiment_arms
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_experiment public.formulation_experiments%ROWTYPE;
  next_position integer;
  created_arm public.formulation_experiment_arms;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can add experiment arms';
  END IF;

  SELECT *
  INTO target_experiment
  FROM public.formulation_experiments
  WHERE id = target_experiment_id
    AND org_id = public.current_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Experiment not found';
  END IF;
  IF target_experiment.lifecycle <> 'draft' THEN
    RAISE EXCEPTION 'Experiment arms can only be changed while the design is a draft';
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) + 1
  INTO next_position
  FROM public.formulation_experiment_arms
  WHERE experiment_id = target_experiment_id;

  IF next_position > 3 THEN
    RAISE EXCEPTION 'The first screen is limited to C0 plus no more than three variants';
  END IF;
  IF NULLIF(trim(target_mechanism), '') IS NULL
     OR NULLIF(trim(target_change_description), '') IS NULL THEN
    RAISE EXCEPTION 'Each variant needs one named mechanism and one predeclared change';
  END IF;

  INSERT INTO public.formulation_experiment_arms (
    org_id,
    experiment_id,
    code,
    label,
    arm_type,
    mechanism,
    change_description,
    sort_order
  )
  VALUES (
    public.current_org_id(),
    target_experiment_id,
    'V' || next_position::text,
    trim(target_label),
    'variant',
    trim(target_mechanism),
    trim(target_change_description),
    next_position
  )
  RETURNING * INTO created_arm;

  RETURN created_arm;
END;
$$;

REVOKE ALL ON FUNCTION public.add_formulation_experiment_arm(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_formulation_experiment_arm(uuid, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.lock_formulation_experiment(target_experiment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_experiment public.formulation_experiments%ROWTYPE;
  arm_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can lock experiment designs';
  END IF;

  SELECT *
  INTO target_experiment
  FROM public.formulation_experiments
  WHERE id = target_experiment_id
    AND org_id = public.current_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Experiment not found';
  END IF;
  IF target_experiment.lifecycle <> 'draft' THEN
    RAISE EXCEPTION 'Only draft experiments can be locked';
  END IF;
  IF NULLIF(trim(target_experiment.serving_protocol), '') IS NULL THEN
    RAISE EXCEPTION 'Define the serving protocol before locking the design';
  END IF;
  IF jsonb_array_length(target_experiment.advancement_gates) = 0 THEN
    RAISE EXCEPTION 'Define at least one advancement gate before locking the design';
  END IF;

  SELECT count(*)
  INTO arm_count
  FROM public.formulation_experiment_arms
  WHERE experiment_id = target_experiment_id;

  IF arm_count < 2 OR arm_count > 4 THEN
    RAISE EXCEPTION 'A locked screen requires C0 plus one to three variants';
  END IF;

  UPDATE public.formulation_experiments
  SET lifecycle = 'locked',
      locked_by = auth.uid(),
      locked_at = now(),
      updated_at = now()
  WHERE id = target_experiment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lock_formulation_experiment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lock_formulation_experiment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.advance_formulation_experiment(
  target_experiment_id uuid,
  target_lifecycle text,
  target_analysis_snapshot jsonb DEFAULT NULL,
  target_winner_arm_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_experiment public.formulation_experiments%ROWTYPE;
  valid_transition boolean := false;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can advance experiments';
  END IF;

  SELECT *
  INTO target_experiment
  FROM public.formulation_experiments
  WHERE id = target_experiment_id
    AND org_id = public.current_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Experiment not found';
  END IF;

  valid_transition := CASE target_experiment.lifecycle
    WHEN 'locked' THEN target_lifecycle IN ('fielding', 'cancelled')
    WHEN 'fielding' THEN target_lifecycle IN ('analysis', 'cancelled')
    WHEN 'analysis' THEN target_lifecycle IN ('confirmation', 'fielding', 'cancelled')
    WHEN 'confirmation' THEN target_lifecycle IN ('complete', 'fielding', 'cancelled')
    ELSE false
  END;

  IF NOT valid_transition THEN
    RAISE EXCEPTION 'Unsupported experiment lifecycle transition from % to %',
      target_experiment.lifecycle,
      target_lifecycle;
  END IF;
  IF target_winner_arm_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.formulation_experiment_arms
    WHERE id = target_winner_arm_id
      AND experiment_id = target_experiment_id
  ) THEN
    RAISE EXCEPTION 'Winner arm does not belong to this experiment';
  END IF;
  IF target_lifecycle IN ('confirmation', 'complete')
     AND (target_analysis_snapshot IS NULL OR target_winner_arm_id IS NULL) THEN
    RAISE EXCEPTION 'Analysis and a selected winner are required before confirmation';
  END IF;

  UPDATE public.formulation_experiments
  SET lifecycle = target_lifecycle,
      analysis_snapshot = COALESCE(target_analysis_snapshot, analysis_snapshot),
      winner_arm_id = COALESCE(target_winner_arm_id, winner_arm_id),
      analyzed_at = CASE
        WHEN target_lifecycle IN ('analysis', 'confirmation', 'complete') THEN now()
        ELSE analyzed_at
      END,
      confirmation_completed_at = CASE
        WHEN target_lifecycle = 'complete' THEN now()
        ELSE confirmation_completed_at
      END,
      updated_at = now()
  WHERE id = target_experiment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.advance_formulation_experiment(uuid, text, jsonb, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.advance_formulation_experiment(uuid, text, jsonb, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_concept_test_decision_freshness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  freshness record;
  source_decision public.decision_records%ROWTYPE;
BEGIN
  IF NEW.project_id IS NULL OR NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;
  IF NEW.decision_record_id IS NULL THEN
    RAISE EXCEPTION 'A confirmed current GO decision is required before launching project concept testing';
  END IF;

  SELECT *
  INTO source_decision
  FROM public.decision_records
  WHERE id = NEW.decision_record_id
    AND project_id = NEW.project_id
    AND org_id = public.current_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The linked decision does not belong to this concept project';
  END IF;

  SELECT *
  INTO freshness
  FROM public.get_decision_freshness(NEW.decision_record_id);

  IF NOT freshness.allowed THEN
    RAISE EXCEPTION '%', freshness.reason;
  END IF;

  NEW.evidence_bundle_id := source_decision.evidence_bundle_id;
  NEW.formulation_version_id := source_decision.formulation_version_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_concept_test_decision_freshness ON public.concept_tests;
CREATE TRIGGER trg_enforce_concept_test_decision_freshness
  BEFORE INSERT OR UPDATE OF status, decision_record_id, project_id
  ON public.concept_tests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_concept_test_decision_freshness();

DROP FUNCTION IF EXISTS public.create_commercialization_report(uuid, uuid, uuid, text, jsonb);

CREATE FUNCTION public.create_commercialization_report(
  target_decision_record_id uuid,
  target_concept_test_id uuid,
  target_packaging_image_id uuid,
  target_title text,
  target_report_snapshot jsonb,
  target_evidence_bundle_id uuid DEFAULT NULL,
  target_formulation_version_id uuid DEFAULT NULL
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

REVOKE ALL ON FUNCTION public.create_commercialization_report(uuid, uuid, uuid, text, jsonb, uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_commercialization_report(uuid, uuid, uuid, text, jsonb, uuid, uuid) TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rag_service') THEN
    GRANT SELECT ON public.evidence_bundles TO rag_service;
    GRANT SELECT ON public.formulation_versions TO rag_service;
    GRANT SELECT ON public.formulation_ingredients TO rag_service;
    GRANT SELECT ON public.formulation_experiments TO rag_service;
    GRANT SELECT ON public.formulation_experiment_arms TO rag_service;
  END IF;
END $$;

COMMENT ON TABLE public.formulation_experiments IS
  'Admin-controlled C0 plus up to three variant formulation experiments linked to exact decision evidence.';
COMMENT ON COLUMN public.evidence_bundles.is_current_product IS
  'Only product-evidence replacement advances this pointer. Literature refreshes do not invalidate a confirmed product decision.';
