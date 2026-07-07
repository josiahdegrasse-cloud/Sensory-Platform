-- Concept brand kit: a durable per-org "house style" that compounds across
-- concepts, plus a per-concept locked design reference.
--
--  • workspace_settings.brand_kit — jsonb holding the org's adopted brand
--    reference: { referenceImagePath, sourceImageId, sourceConceptName,
--    brandDescriptor, updatedAt, updatedBy }. Written only by an explicit
--    admin "Set as company brand" action (audited via workspace settings
--    update path), never automatically.
--  • concept_tests.brand_reference_image_id — the concept image an admin
--    locked as this concept's product design; later generations for the
--    concept re-stage that exact design via the image-edit endpoint.
--
-- Both are additive and nullable; app code degrades gracefully when this
-- migration has not been applied (upsert_workspace_settings uses
-- jsonb_populate_record, which ignores unknown keys, and the concept insert
-- retries without the column).

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS brand_kit jsonb NOT NULL DEFAULT '{}';

ALTER TABLE public.concept_tests
  ADD COLUMN IF NOT EXISTS brand_reference_image_id uuid
    REFERENCES public.concept_images(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_concept_tests_brand_reference
  ON public.concept_tests (brand_reference_image_id)
  WHERE brand_reference_image_id IS NOT NULL;
