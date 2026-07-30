-- Explicit prototype lineage
--
-- The imported prototype's durable identity is instrumental_samples.id. Legacy
-- workflow records used text sample ids (and, for studies, batch + sample text),
-- which made lineage ambiguous once a project contained more than one batch.
-- This migration adds nullable UUID links, backfills only exact matches, and
-- leaves ambiguous history visible through a reconciliation view.

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS instrumental_sample_id uuid
    REFERENCES public.instrumental_samples(id) ON DELETE SET NULL;

ALTER TABLE public.decision_records
  ADD COLUMN IF NOT EXISTS instrumental_sample_id uuid
    REFERENCES public.instrumental_samples(id) ON DELETE SET NULL;

ALTER TABLE public.evidence_bundles
  ADD COLUMN IF NOT EXISTS instrumental_sample_id uuid
    REFERENCES public.instrumental_samples(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_instrumental_sample
  ON public.products(instrumental_sample_id)
  WHERE instrumental_sample_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_decision_records_instrumental_sample
  ON public.decision_records(instrumental_sample_id)
  WHERE instrumental_sample_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_instrumental_sample
  ON public.evidence_bundles(instrumental_sample_id)
  WHERE instrumental_sample_id IS NOT NULL;

-- Imported products have an exact source batch + source sample pair. Manual
-- studies intentionally remain NULL because they do not represent an imported
-- instrumental prototype.
UPDATE public.products AS product
SET instrumental_sample_id = sample.id
FROM public.instrumental_samples AS sample
WHERE product.instrumental_sample_id IS NULL
  AND product.org_id = sample.org_id
  AND product.source_import_batch_id = sample.import_batch_id
  AND product.source_sample_id = sample.sample_id;

-- A formulation version is the strongest existing link to an instrumental
-- sample. Prefer it over text matching whenever it exists.
UPDATE public.decision_records AS decision
SET instrumental_sample_id = formulation.instrumental_sample_id
FROM public.formulation_versions AS formulation
WHERE decision.instrumental_sample_id IS NULL
  AND decision.formulation_version_id = formulation.id
  AND decision.org_id = formulation.org_id
  AND (decision.project_id IS NULL OR decision.project_id = formulation.project_id);

UPDATE public.evidence_bundles AS bundle
SET instrumental_sample_id = formulation.instrumental_sample_id
FROM public.formulation_versions AS formulation
WHERE bundle.instrumental_sample_id IS NULL
  AND bundle.formulation_version_id = formulation.id
  AND bundle.org_id = formulation.org_id
  AND (bundle.project_id IS NULL OR bundle.project_id = formulation.project_id);

-- Fall back to project + sample text only when it resolves to exactly one live
-- instrumental row. Duplicate sample labels across batches remain unresolved.
WITH candidates AS (
  SELECT
    decision.id AS decision_id,
    (array_agg(sample.id ORDER BY sample.created_at, sample.id))[1] AS sample_id
  FROM public.decision_records AS decision
  JOIN public.instrumental_samples AS sample
    ON sample.org_id = decision.org_id
   AND sample.project_id = decision.project_id
   AND sample.sample_id = decision.sample_id
  WHERE decision.instrumental_sample_id IS NULL
  GROUP BY decision.id
  HAVING count(*) = 1
)
UPDATE public.decision_records AS decision
SET instrumental_sample_id = candidates.sample_id
FROM candidates
WHERE decision.id = candidates.decision_id;

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

-- Future imported studies inherit the exact sample link automatically, while
-- supplied links are checked against tenant, project, batch, and sample text.
CREATE OR REPLACE FUNCTION public.set_product_prototype_lineage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  resolved_id uuid;
  linked_sample public.instrumental_samples%ROWTYPE;
BEGIN
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

DROP TRIGGER IF EXISTS trg_product_prototype_lineage ON public.products;
CREATE TRIGGER trg_product_prototype_lineage
  BEFORE INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_product_prototype_lineage();

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

DROP TRIGGER IF EXISTS trg_decision_prototype_lineage ON public.decision_records;
CREATE TRIGGER trg_decision_prototype_lineage
  BEFORE INSERT OR UPDATE ON public.decision_records
  FOR EACH ROW EXECUTE FUNCTION public.set_decision_prototype_lineage();

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

DROP TRIGGER IF EXISTS trg_evidence_prototype_lineage ON public.evidence_bundles;
CREATE TRIGGER trg_evidence_prototype_lineage
  BEFORE INSERT OR UPDATE ON public.evidence_bundles
  FOR EACH ROW EXECUTE FUNCTION public.set_evidence_prototype_lineage();

-- Admin-facing truth surface for historical records that need explicit review.
-- security_invoker keeps every underlying table's RLS policy in force.
CREATE OR REPLACE VIEW public.prototype_lineage_reconciliation
WITH (security_invoker = true)
AS
  SELECT
    product.org_id,
    'study'::text AS entity_type,
    product.id AS entity_id,
    product.project_id,
    product.source_sample_id AS sample_key,
    'Imported study has no exact instrumental sample link'::text AS reason,
    product.created_at
  FROM public.products AS product
  WHERE product.source_sample_id IS NOT NULL
    AND product.instrumental_sample_id IS NULL

  UNION ALL

  SELECT
    decision.org_id,
    'decision'::text,
    decision.id,
    decision.project_id,
    decision.sample_id,
    'Decision sample text is missing or ambiguous within the project'::text,
    decision.created_at
  FROM public.decision_records AS decision
  WHERE decision.instrumental_sample_id IS NULL

  UNION ALL

  SELECT
    bundle.org_id,
    'evidence_bundle'::text,
    bundle.id,
    bundle.project_id,
    bundle.sample_id,
    'Evidence bundle sample text is missing or ambiguous within the project'::text,
    bundle.created_at
  FROM public.evidence_bundles AS bundle
  WHERE bundle.instrumental_sample_id IS NULL

  UNION ALL

  SELECT
    concept.org_id,
    'concept'::text,
    concept.id,
    concept.project_id,
    NULL::text,
    'Concept has no authoritative decision link'::text,
    concept.created_at
  FROM public.concept_tests AS concept
  WHERE concept.decision_record_id IS NULL;

REVOKE ALL ON public.prototype_lineage_reconciliation FROM PUBLIC;
GRANT SELECT ON public.prototype_lineage_reconciliation TO authenticated;

COMMENT ON COLUMN public.products.instrumental_sample_id IS
  'Canonical imported prototype for this study; NULL for manual/non-instrumental studies.';
COMMENT ON COLUMN public.decision_records.instrumental_sample_id IS
  'Canonical imported prototype evaluated by this immutable decision.';
COMMENT ON COLUMN public.evidence_bundles.instrumental_sample_id IS
  'Canonical imported prototype captured by this evidence snapshot.';
COMMENT ON VIEW public.prototype_lineage_reconciliation IS
  'Tenant-isolated historical records whose prototype or decision lineage cannot be inferred safely.';

COMMIT;
