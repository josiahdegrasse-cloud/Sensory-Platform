-- Keep the project assigned to an import batch authoritative for every
-- prototype created from that batch. Previously, changing import_batches.project_id
-- left instrumental_samples.project_id and products.project_id behind. Decision
-- confirmation then correctly rejected the stale prototype/project pairing.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_import_batch_project_lineage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  linked_project public.projects%ROWTYPE;
BEGIN
  IF NEW.project_id IS NOT DISTINCT FROM OLD.project_id THEN
    RETURN NEW;
  END IF;

  IF NEW.project_id IS NOT NULL THEN
    SELECT * INTO linked_project
    FROM public.projects
    WHERE id = NEW.project_id;

    IF NOT FOUND
       OR linked_project.org_id IS DISTINCT FROM NEW.org_id
       OR linked_project.food_type_id IS DISTINCT FROM NEW.food_type_id THEN
      RAISE EXCEPTION 'Import batch project does not match its tenant or food type';
    END IF;
  END IF;

  -- Decisions are immutable audit records. Do not silently move a prototype to
  -- another project after a decision has been recorded for it.
  IF EXISTS (
    SELECT 1
    FROM public.decision_records AS decision
    JOIN public.instrumental_samples AS sample
      ON sample.id = decision.instrumental_sample_id
    WHERE sample.import_batch_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'An import batch with recorded decisions cannot be reassigned to another project';
  END IF;

  UPDATE public.instrumental_samples
  SET project_id = NEW.project_id
  WHERE import_batch_id = NEW.id
    AND project_id IS DISTINCT FROM NEW.project_id;

  UPDATE public.products
  SET project_id = NEW.project_id
  WHERE source_import_batch_id = NEW.id
    AND project_id IS DISTINCT FROM NEW.project_id;

  UPDATE public.formulation_versions AS formulation
  SET project_id = NEW.project_id
  FROM public.instrumental_samples AS sample
  WHERE formulation.instrumental_sample_id = sample.id
    AND sample.import_batch_id = NEW.id
    AND formulation.project_id IS DISTINCT FROM NEW.project_id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_import_batch_project_lineage() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_sync_import_batch_project_lineage ON public.import_batches;
CREATE TRIGGER trg_sync_import_batch_project_lineage
  AFTER UPDATE OF project_id ON public.import_batches
  FOR EACH ROW EXECUTE FUNCTION public.sync_import_batch_project_lineage();

-- Repair rows created or reassigned before the invariant existed. The batch is
-- the durable source of project identity for an imported prototype.
UPDATE public.instrumental_samples AS sample
SET project_id = batch.project_id
FROM public.import_batches AS batch
WHERE sample.import_batch_id = batch.id
  AND batch.status = 'active'
  AND sample.project_id IS DISTINCT FROM batch.project_id;

UPDATE public.products AS product
SET project_id = batch.project_id
FROM public.import_batches AS batch
WHERE product.source_import_batch_id = batch.id
  AND batch.status = 'active'
  AND product.project_id IS DISTINCT FROM batch.project_id;

UPDATE public.formulation_versions AS formulation
SET project_id = sample.project_id
FROM public.instrumental_samples AS sample
JOIN public.import_batches AS batch ON batch.id = sample.import_batch_id
WHERE formulation.instrumental_sample_id = sample.id
  AND batch.status = 'active'
  AND formulation.project_id IS DISTINCT FROM sample.project_id;

-- A failed confirmation may already have created an unlinked evidence bundle.
-- Backfill only when project + sample text resolves to exactly one prototype.
WITH candidates AS (
  SELECT
    bundle.id AS bundle_id,
    (array_agg(sample.id ORDER BY sample.created_at, sample.id))[1] AS sample_id
  FROM public.evidence_bundles AS bundle
  JOIN public.instrumental_samples AS sample
    ON sample.org_id = bundle.org_id
   AND sample.project_id = bundle.project_id
   AND sample.sample_id = bundle.sample_id
  WHERE bundle.instrumental_sample_id IS NULL
  GROUP BY bundle.id
  HAVING count(*) = 1
)
UPDATE public.evidence_bundles AS bundle
SET instrumental_sample_id = candidates.sample_id
FROM candidates
WHERE bundle.id = candidates.bundle_id;

COMMIT;
