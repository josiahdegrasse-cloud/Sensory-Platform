-- Configurable questionnaire sections and explicit post-import survey launch.
-- Imports remain data-only until an administrator selects sections and sends.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS survey_sections text[] NOT NULL
  DEFAULT ARRAY['cata', 'intensity', 'hedonic', 'emotions', 'comments']::text[];

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_survey_sections_valid;

ALTER TABLE public.products
  ADD CONSTRAINT products_survey_sections_valid CHECK (
    cardinality(survey_sections) > 0
    AND survey_sections <@ ARRAY['cata', 'intensity', 'hedonic', 'emotions', 'comments']::text[]
    AND (
      NOT survey_sections @> ARRAY['intensity']::text[]
      OR survey_sections @> ARRAY['cata']::text[]
    )
  );

-- Survey creation is now an explicit reviewed action after import. Keep the
-- legacy setting for RPC compatibility, but lock its default and current value
-- to the safe data-only behavior.
ALTER TABLE public.workspace_settings
  ALTER COLUMN auto_create_surveys_from_imports SET DEFAULT false;

UPDATE public.workspace_settings
SET auto_create_surveys_from_imports = false,
    require_import_review = true;

COMMENT ON COLUMN public.products.survey_sections IS
  'Ordered questionnaire sections selected by an administrator before launch.';

COMMENT ON COLUMN public.workspace_settings.auto_create_surveys_from_imports IS
  'Legacy compatibility flag. New imports use explicit post-import survey configuration.';
