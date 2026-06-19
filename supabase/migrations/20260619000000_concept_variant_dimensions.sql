-- Add structured variant dimension metadata to concept tests.
-- Each concept can store up to 8 positioning dimensions as a jsonb object.
-- The existing org_isolation restrictive policy covers this column automatically.

ALTER TABLE public.concept_tests
  ADD COLUMN IF NOT EXISTS variant_dimensions jsonb DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_concept_tests_variant_dims
  ON public.concept_tests USING GIN(variant_dimensions);
