-- Professional concept image system: per-image prompt style + review lifecycle.
--
-- review_status lifecycle: draft → selected (visible to panelists) → approved
-- (used in a commercialization report), with rejected as a terminal side-state.
-- selected_for_panelists stays the source of truth for panelist visibility;
-- review_status is the richer admin/report-facing label layered on top.

ALTER TABLE public.concept_images
  ADD COLUMN IF NOT EXISTS prompt_style text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft', 'selected', 'approved', 'rejected'));

-- Backfill prompt_style from the parent generation (images inherited its style).
UPDATE public.concept_images AS i
SET prompt_style = g.prompt_style
FROM public.concept_image_generations AS g
WHERE i.generation_id = g.id
  AND i.prompt_style = '';

-- Backfill review_status from existing signals, weakest to strongest.
UPDATE public.concept_images
SET review_status = 'selected'
WHERE selected_for_panelists = true
  AND review_status = 'draft';

UPDATE public.concept_images
SET review_status = 'rejected'
WHERE archived_at IS NOT NULL;

UPDATE public.concept_images
SET review_status = 'approved'
WHERE id IN (
  SELECT packaging_image_id
  FROM public.commercialization_reports
  WHERE packaging_image_id IS NOT NULL
);

-- Allow the new prompt styles as workspace defaults while keeping the legacy
-- six valid (existing rows keep working; legacy ids are aliased in app code).
ALTER TABLE public.concept_generation_settings
  DROP CONSTRAINT IF EXISTS concept_generation_settings_prompt_style_check;
ALTER TABLE public.concept_generation_settings
  ADD CONSTRAINT concept_generation_settings_prompt_style_check
  CHECK (prompt_style IN (
    'balanced', 'premium', 'natural', 'family', 'foodservice', 'clean-label',
    'premium_natural', 'clean_clinical', 'playful_modern', 'rustic_artisanal',
    'bold_retail', 'health_forward', 'indulgent_premium', 'family_friendly',
    'sustainable_earthy', 'minimalist_ecommerce'
  ));
