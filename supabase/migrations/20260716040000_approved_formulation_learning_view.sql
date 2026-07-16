-- A deliberately narrow retrieval surface for portfolio learning.
-- It exposes only completed, human-approved lessons and their provenance;
-- raw evaluations and unapproved learning drafts remain behind the source tables.

CREATE VIEW public.approved_formulation_learnings
WITH (security_invoker = true)
AS
SELECT
  experiment.id,
  experiment.org_id,
  experiment.project_id,
  project.name AS project_name,
  experiment.decision_record_id,
  experiment.evidence_bundle_id,
  experiment.formulation_version_id,
  experiment.name AS experiment_name,
  experiment.measured_driver,
  experiment.hypothesis,
  experiment.primary_outcome,
  experiment.learning_summary,
  experiment.learning_tags,
  experiment.learning_applies_to,
  experiment.learning_limitations,
  experiment.learning_approved_at,
  experiment.updated_at
FROM public.formulation_experiments AS experiment
JOIN public.projects AS project
  ON project.id = experiment.project_id
 AND project.org_id = experiment.org_id
WHERE experiment.lifecycle = 'complete'
  AND experiment.learning_status = 'approved'
  AND experiment.learning_summary IS NOT NULL;

GRANT SELECT ON public.approved_formulation_learnings TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rag_service') THEN
    GRANT SELECT ON public.approved_formulation_learnings TO rag_service;
  END IF;
END
$$;

COMMENT ON VIEW public.approved_formulation_learnings IS
  'Safe portfolio-learning retrieval surface containing only human-approved lessons with source provenance and explicit limitations.';
