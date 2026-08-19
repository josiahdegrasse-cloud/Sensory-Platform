-- PostgreSQL runs same-timing triggers alphabetically. The prototype-lineage
-- triggers run before trg_set_org_id, so client inserts that omit org_id were
-- validated while NEW.org_id was still NULL. Stamp the caller's tenant inside
-- each lineage trigger before resolving or validating an exact prototype.

BEGIN;

CREATE OR REPLACE FUNCTION public.set_product_prototype_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  resolved_id uuid;
  linked_sample public.instrumental_samples%ROWTYPE;
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.current_org_id();
  END IF;
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'No organization context for product prototype lineage';
  END IF;

  IF NEW.instrumental_sample_id IS NULL
     AND NEW.source_import_batch_id IS NOT NULL
     AND NEW.source_sample_id IS NOT NULL THEN
    SELECT sample.id INTO resolved_id
    FROM public.instrumental_samples AS sample
    WHERE sample.org_id = NEW.org_id
      AND sample.import_batch_id = NEW.source_import_batch_id
      AND sample.sample_id = NEW.source_sample_id;
    NEW.instrumental_sample_id := resolved_id;
  END IF;

  IF NEW.instrumental_sample_id IS NOT NULL THEN
    SELECT * INTO linked_sample
    FROM public.instrumental_samples
    WHERE id = NEW.instrumental_sample_id;

    IF NOT FOUND
       OR linked_sample.org_id IS DISTINCT FROM NEW.org_id
       OR (NEW.project_id IS NOT NULL AND linked_sample.project_id IS DISTINCT FROM NEW.project_id)
       OR (NEW.source_import_batch_id IS NOT NULL AND linked_sample.import_batch_id IS DISTINCT FROM NEW.source_import_batch_id)
       OR (NEW.source_sample_id IS NOT NULL AND linked_sample.sample_id IS DISTINCT FROM NEW.source_sample_id) THEN
      RAISE EXCEPTION 'Product prototype lineage does not match its tenant, project, or source sample';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_decision_prototype_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  candidate_ids uuid[];
  resolved_id uuid;
  linked_sample public.instrumental_samples%ROWTYPE;
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.current_org_id();
  END IF;
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'No organization context for decision prototype lineage';
  END IF;

  IF NEW.instrumental_sample_id IS NULL AND NEW.formulation_version_id IS NOT NULL THEN
    SELECT formulation.instrumental_sample_id INTO resolved_id
    FROM public.formulation_versions AS formulation
    WHERE formulation.id = NEW.formulation_version_id
      AND formulation.org_id = NEW.org_id
      AND (NEW.project_id IS NULL OR formulation.project_id = NEW.project_id);
    NEW.instrumental_sample_id := resolved_id;
  END IF;

  IF NEW.instrumental_sample_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT array_agg(sample.id ORDER BY sample.created_at, sample.id) INTO candidate_ids
    FROM public.instrumental_samples AS sample
    WHERE sample.org_id = NEW.org_id
      AND sample.project_id = NEW.project_id
      AND sample.sample_id = NEW.sample_id;
    IF cardinality(candidate_ids) = 1 THEN
      NEW.instrumental_sample_id := candidate_ids[1];
    END IF;
  END IF;

  IF NEW.instrumental_sample_id IS NOT NULL THEN
    SELECT * INTO linked_sample
    FROM public.instrumental_samples
    WHERE id = NEW.instrumental_sample_id;

    IF NOT FOUND
       OR linked_sample.org_id IS DISTINCT FROM NEW.org_id
       OR (NEW.project_id IS NOT NULL AND linked_sample.project_id IS DISTINCT FROM NEW.project_id)
       OR linked_sample.sample_id IS DISTINCT FROM NEW.sample_id THEN
      RAISE EXCEPTION 'Decision prototype lineage does not match its tenant, project, or sample';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_evidence_prototype_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  candidate_ids uuid[];
  resolved_id uuid;
  linked_sample public.instrumental_samples%ROWTYPE;
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.current_org_id();
  END IF;
  IF NEW.org_id IS NULL THEN
    RAISE EXCEPTION 'No organization context for evidence prototype lineage';
  END IF;

  IF NEW.instrumental_sample_id IS NULL AND NEW.formulation_version_id IS NOT NULL THEN
    SELECT formulation.instrumental_sample_id INTO resolved_id
    FROM public.formulation_versions AS formulation
    WHERE formulation.id = NEW.formulation_version_id
      AND formulation.org_id = NEW.org_id
      AND (NEW.project_id IS NULL OR formulation.project_id = NEW.project_id);
    NEW.instrumental_sample_id := resolved_id;
  END IF;

  IF NEW.instrumental_sample_id IS NULL AND NEW.project_id IS NOT NULL THEN
    SELECT array_agg(sample.id ORDER BY sample.created_at, sample.id) INTO candidate_ids
    FROM public.instrumental_samples AS sample
    WHERE sample.org_id = NEW.org_id
      AND sample.project_id = NEW.project_id
      AND sample.sample_id = NEW.sample_id;
    IF cardinality(candidate_ids) = 1 THEN
      NEW.instrumental_sample_id := candidate_ids[1];
    END IF;
  END IF;

  IF NEW.instrumental_sample_id IS NOT NULL THEN
    SELECT * INTO linked_sample
    FROM public.instrumental_samples
    WHERE id = NEW.instrumental_sample_id;

    IF NOT FOUND
       OR linked_sample.org_id IS DISTINCT FROM NEW.org_id
       OR (NEW.project_id IS NOT NULL AND linked_sample.project_id IS DISTINCT FROM NEW.project_id)
       OR linked_sample.sample_id IS DISTINCT FROM NEW.sample_id THEN
      RAISE EXCEPTION 'Evidence prototype lineage does not match its tenant, project, or sample';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Repair exact links that earlier NULL-org trigger execution left unresolved.
UPDATE public.products AS product
SET instrumental_sample_id = sample.id
FROM public.instrumental_samples AS sample
WHERE product.instrumental_sample_id IS NULL
  AND product.org_id = sample.org_id
  AND product.source_import_batch_id = sample.import_batch_id
  AND product.source_sample_id = sample.sample_id;

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
