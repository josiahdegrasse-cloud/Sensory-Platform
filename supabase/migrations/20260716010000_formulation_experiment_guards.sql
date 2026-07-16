-- Guard the guided experiment lifecycle after the base tables are live.

CREATE TRIGGER trg_set_org_id_formulation_experiments
  BEFORE INSERT ON public.formulation_experiments
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org_id_formulation_experiment_arms
  BEFORE INSERT ON public.formulation_experiment_arms
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org_id_formulation_experiment_trials
  BEFORE INSERT ON public.formulation_experiment_trials
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();
CREATE TRIGGER trg_set_org_id_formulation_experiment_evaluations
  BEFORE INSERT ON public.formulation_experiment_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

CREATE OR REPLACE FUNCTION public.guard_formulation_experiment_design()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF OLD.lifecycle <> 'draft' AND (
    NEW.name IS DISTINCT FROM OLD.name
    OR NEW.measured_driver IS DISTINCT FROM OLD.measured_driver
    OR NEW.hypothesis IS DISTINCT FROM OLD.hypothesis
    OR NEW.primary_outcome IS DISTINCT FROM OLD.primary_outcome
    OR NEW.primary_scale_min IS DISTINCT FROM OLD.primary_scale_min
    OR NEW.primary_scale_max IS DISTINCT FROM OLD.primary_scale_max
    OR NEW.analysis_mode IS DISTINCT FROM OLD.analysis_mode
    OR NEW.bootstrap_iterations IS DISTINCT FROM OLD.bootstrap_iterations
    OR NEW.confidence_level IS DISTINCT FROM OLD.confidence_level
    OR NEW.deterministic_seed IS DISTINCT FROM OLD.deterministic_seed
    OR NEW.minimum_n IS DISTINCT FROM OLD.minimum_n
    OR NEW.uncertainty_margin IS DISTINCT FROM OLD.uncertainty_margin
    OR NEW.serving_protocol IS DISTINCT FROM OLD.serving_protocol
    OR NEW.storage_checkpoints IS DISTINCT FROM OLD.storage_checkpoints
    OR NEW.advancement_gates IS DISTINCT FROM OLD.advancement_gates
  ) THEN
    RAISE EXCEPTION 'The predeclared experiment design is immutable after locking';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_formulation_experiment_design
  BEFORE UPDATE ON public.formulation_experiments
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_formulation_experiment_design();

CREATE OR REPLACE FUNCTION public.guard_formulation_experiment_arm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_experiment_id uuid := COALESCE(NEW.experiment_id, OLD.experiment_id);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.formulation_experiments
    WHERE id = target_experiment_id
      AND lifecycle = 'draft'
      AND org_id = public.current_org_id()
  ) THEN
    RAISE EXCEPTION 'Experiment arms are immutable after the design is locked';
  END IF;
  IF TG_OP = 'DELETE' AND OLD.arm_type = 'control' THEN
    RAISE EXCEPTION 'The C0 control arm cannot be deleted';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER trg_guard_formulation_experiment_arm
  BEFORE INSERT OR UPDATE OR DELETE ON public.formulation_experiment_arms
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_formulation_experiment_arm();

CREATE OR REPLACE FUNCTION public.guard_formulation_experiment_trial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.formulation_experiments
    WHERE id = NEW.experiment_id
      AND lifecycle IN ('fielding', 'analysis')
      AND org_id = public.current_org_id()
  ) THEN
    RAISE EXCEPTION 'Evaluations can only be recorded during fielding or analysis';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_formulation_experiment_trial
  BEFORE INSERT OR UPDATE ON public.formulation_experiment_trials
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_formulation_experiment_trial();

CREATE OR REPLACE FUNCTION public.guard_formulation_experiment_evaluation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_experiment public.formulation_experiments%ROWTYPE;
BEGIN
  SELECT *
  INTO target_experiment
  FROM public.formulation_experiments
  WHERE id = NEW.experiment_id
    AND lifecycle IN ('fielding', 'analysis')
    AND org_id = public.current_org_id();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Evaluations can only be recorded during fielding or analysis';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.formulation_experiment_trials
    WHERE id = NEW.trial_id AND experiment_id = NEW.experiment_id
  ) THEN
    RAISE EXCEPTION 'Evaluation trial does not belong to this experiment';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.formulation_experiment_arms
    WHERE id = NEW.arm_id AND experiment_id = NEW.experiment_id
  ) THEN
    RAISE EXCEPTION 'Evaluation arm does not belong to this experiment';
  END IF;
  IF NEW.primary_score < target_experiment.primary_scale_min
     OR NEW.primary_score > target_experiment.primary_scale_max THEN
    RAISE EXCEPTION 'Primary score must be between % and %',
      target_experiment.primary_scale_min,
      target_experiment.primary_scale_max;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_formulation_experiment_evaluation
  BEFORE INSERT OR UPDATE ON public.formulation_experiment_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_formulation_experiment_evaluation();
