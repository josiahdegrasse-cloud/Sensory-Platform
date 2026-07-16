-- Promote completed formulation experiments into traceable, human-approved
-- organizational learning without changing the underlying decision engine.

ALTER TABLE public.formulation_experiments
  ADD COLUMN learning_summary text,
  ADD COLUMN learning_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN learning_applies_to text[] NOT NULL DEFAULT '{}',
  ADD COLUMN learning_limitations text[] NOT NULL DEFAULT '{}',
  ADD COLUMN learning_status text NOT NULL DEFAULT 'not_captured'
    CHECK (learning_status IN ('not_captured', 'draft', 'approved')),
  ADD COLUMN learning_approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN learning_approved_at timestamptz,
  ADD CONSTRAINT formulation_experiments_approved_learning_complete
    CHECK (
      learning_status <> 'approved'
      OR (
        lifecycle = 'complete'
        AND char_length(trim(COALESCE(learning_summary, ''))) > 0
        AND learning_approved_by IS NOT NULL
        AND learning_approved_at IS NOT NULL
      )
    );

CREATE INDEX idx_formulation_experiments_approved_learning
  ON public.formulation_experiments(org_id, learning_approved_at DESC)
  WHERE learning_status = 'approved';

CREATE INDEX idx_formulation_experiments_learning_tags
  ON public.formulation_experiments USING gin(learning_tags)
  WHERE learning_status = 'approved';

CREATE OR REPLACE FUNCTION public.save_formulation_experiment_learning(
  target_experiment_id uuid,
  target_summary text,
  target_tags text[] DEFAULT '{}',
  target_applies_to text[] DEFAULT '{}',
  target_limitations text[] DEFAULT '{}',
  target_status text DEFAULT 'draft'
)
RETURNS public.formulation_experiments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_experiment public.formulation_experiments%ROWTYPE;
  saved_experiment public.formulation_experiments%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF target_status NOT IN ('draft', 'approved') THEN
    RAISE EXCEPTION 'Learning status must be draft or approved';
  END IF;

  IF char_length(trim(COALESCE(target_summary, ''))) = 0 THEN
    RAISE EXCEPTION 'A learning summary is required';
  END IF;

  IF cardinality(COALESCE(target_tags, '{}')) > 20
     OR cardinality(COALESCE(target_applies_to, '{}')) > 20
     OR cardinality(COALESCE(target_limitations, '{}')) > 20 THEN
    RAISE EXCEPTION 'Learning lists are limited to 20 entries each';
  END IF;

  SELECT *
  INTO target_experiment
  FROM public.formulation_experiments
  WHERE id = target_experiment_id
    AND org_id = public.current_org_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Formulation experiment not found';
  END IF;

  IF target_experiment.lifecycle <> 'complete' THEN
    RAISE EXCEPTION 'Only completed experiments can create reusable learning';
  END IF;

  UPDATE public.formulation_experiments
  SET
    learning_summary = trim(target_summary),
    learning_tags = COALESCE(target_tags, '{}'),
    learning_applies_to = COALESCE(target_applies_to, '{}'),
    learning_limitations = COALESCE(target_limitations, '{}'),
    learning_status = target_status,
    learning_approved_by = CASE WHEN target_status = 'approved' THEN auth.uid() ELSE NULL END,
    learning_approved_at = CASE WHEN target_status = 'approved' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = target_experiment_id
    AND org_id = public.current_org_id()
  RETURNING *
  INTO saved_experiment;

  RETURN saved_experiment;
END;
$$;

REVOKE ALL ON FUNCTION public.save_formulation_experiment_learning(
  uuid, text, text[], text[], text[], text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_formulation_experiment_learning(
  uuid, text, text[], text[], text[], text
) TO authenticated;

COMMENT ON COLUMN public.formulation_experiments.learning_summary IS
  'Human-authored lesson from a completed experiment. Reusable only when learning_status is approved.';
COMMENT ON COLUMN public.formulation_experiments.learning_applies_to IS
  'Explicit product, formulation, process, or category contexts where the approved lesson may be considered.';
COMMENT ON COLUMN public.formulation_experiments.learning_limitations IS
  'Known boundaries that must accompany the lesson whenever it is reused.';
