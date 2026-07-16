-- Make generated insert types reflect the tenant auto-stamping triggers.

ALTER TABLE public.formulation_experiments
  ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.formulation_experiment_arms
  ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.formulation_experiment_trials
  ALTER COLUMN org_id SET DEFAULT public.current_org_id();
ALTER TABLE public.formulation_experiment_evaluations
  ALTER COLUMN org_id SET DEFAULT public.current_org_id();
