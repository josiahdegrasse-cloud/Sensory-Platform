-- Explicit product lineage tracking for retest / reformulation workflows.
--
-- parent_decision_id: when a TWEAK/STOP decision triggers a retest import,
-- the new decision record stores the id of the decision that prompted it,
-- making the formulation iteration chain queryable without relying on naming
-- conventions.
--
-- reformulation_notes: free-text field on import_batches capturing what
-- changed between formulation versions (populated from the TweakPrescription
-- target + action at retest import time).

ALTER TABLE public.decision_records
  ADD COLUMN IF NOT EXISTS parent_decision_id uuid
    REFERENCES public.decision_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_decision_records_parent
  ON public.decision_records(parent_decision_id)
  WHERE parent_decision_id IS NOT NULL;

ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS reformulation_notes text;
