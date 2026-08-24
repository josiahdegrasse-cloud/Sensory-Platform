-- Reconcile legacy lineage only where later authoritative records prove one
-- exact project, prototype, and GO-decision path. Ambiguous history remains in
-- prototype_lineage_reconciliation for human review; it is never guessed.

BEGIN;

-- These two July S4 decisions reference the same current evidence bundle. That
-- bundle is already linked to one project and one instrumental sample.
UPDATE public.decision_records AS decision
SET
  project_id = bundle.project_id,
  instrumental_sample_id = bundle.instrumental_sample_id
FROM public.evidence_bundles AS bundle
WHERE decision.id IN (
    '7689087a-7eb1-489e-bc19-96397338731d'::uuid,
    '5bfff75f-ec82-4ba2-a983-6d1ca6c43b21'::uuid
  )
  AND decision.evidence_bundle_id = bundle.id
  AND decision.org_id = bundle.org_id
  AND decision.sample_id = bundle.sample_id
  AND bundle.id = '0276f4d7-cf2b-4fa8-a94d-f5507e3c1e51'::uuid
  AND bundle.project_id = 'b5fcd5cd-6b1b-4c52-9adc-91a1993c818e'::uuid
  AND bundle.instrumental_sample_id = '6c547563-b8e1-44e5-bbe2-2da9d7efd06c'::uuid;

-- This Cashew Cream Cheese concept is referenced by multiple saved reports,
-- all of which point to the same GO decision. Copy that authoritative lineage.
-- The normal trigger expects an authenticated request context, which migrations
-- intentionally do not have. Disable it only around these exact historical
-- backfills; future writes remain governed by the same trigger.
ALTER TABLE public.concept_tests
  DISABLE TRIGGER trg_enforce_concept_test_decision_freshness;

UPDATE public.concept_tests AS concept
SET
  project_id = decision.project_id,
  decision_record_id = decision.id,
  evidence_bundle_id = decision.evidence_bundle_id
FROM public.decision_records AS decision
WHERE concept.id = 'c3fa84f5-1463-4648-bd16-d88cec2a3928'::uuid
  AND decision.id = 'e180a4a2-2e08-4d73-a15b-4897f740efe9'::uuid
  AND decision.decision = 'GO'
  AND decision.project_id IS NOT NULL
  AND decision.evidence_bundle_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.commercialization_reports AS report
    WHERE report.concept_test_id = concept.id
      AND report.decision_record_id <> decision.id
  )
  AND EXISTS (
    SELECT 1
    FROM public.commercialization_reports AS report
    WHERE report.concept_test_id = concept.id
      AND report.decision_record_id = decision.id
  );

-- This archived VitaCheese concept has the same one-decision report history.
UPDATE public.concept_tests AS concept
SET
  project_id = decision.project_id,
  decision_record_id = decision.id,
  evidence_bundle_id = decision.evidence_bundle_id
FROM public.decision_records AS decision
WHERE concept.id = '92edb9bd-feb6-42f1-9da6-97f1069c999d'::uuid
  AND decision.id = '8a9dd594-626a-42ff-8cdf-3dc49166e150'::uuid
  AND decision.decision = 'GO'
  AND decision.project_id IS NOT NULL
  AND decision.evidence_bundle_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.commercialization_reports AS report
    WHERE report.concept_test_id = concept.id
      AND report.decision_record_id <> decision.id
  )
  AND EXISTS (
    SELECT 1
    FROM public.commercialization_reports AS report
    WHERE report.concept_test_id = concept.id
      AND report.decision_record_id = decision.id
  );

ALTER TABLE public.concept_tests
  ENABLE TRIGGER trg_enforce_concept_test_decision_freshness;

DO $$
DECLARE
  remaining_count integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.prototype_lineage_reconciliation
    WHERE entity_id IN (
      '7689087a-7eb1-489e-bc19-96397338731d'::uuid,
      '5bfff75f-ec82-4ba2-a983-6d1ca6c43b21'::uuid,
      'c3fa84f5-1463-4648-bd16-d88cec2a3928'::uuid,
      '92edb9bd-feb6-42f1-9da6-97f1069c999d'::uuid
    )
  ) THEN
    RAISE EXCEPTION 'One or more proven legacy lineage repairs did not reconcile';
  END IF;

  SELECT count(*) INTO remaining_count
  FROM public.prototype_lineage_reconciliation;

  -- This migration originally ran against a production snapshot with 16
  -- ambiguous records. A fresh database correctly has none, while future
  -- installations may have a different reviewed-data count. The exact proven
  -- repairs above remain fail-closed; the snapshot count is diagnostic only.
  RAISE NOTICE '% ambiguous lineage records remain for human review', remaining_count;
END;
$$;

COMMIT;
