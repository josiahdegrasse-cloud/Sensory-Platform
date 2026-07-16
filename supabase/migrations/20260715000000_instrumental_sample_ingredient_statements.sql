-- Preserve the exact ingredient statement for each imported formulation.
-- Ingredient order is meaningful for labeling/compliance, so this is stored
-- verbatim on the instrumental sample rather than normalized into a list.

ALTER TABLE public.instrumental_samples
  ADD COLUMN IF NOT EXISTS ingredient_statement text,
  ADD COLUMN IF NOT EXISTS ingredient_statement_source text NOT NULL DEFAULT 'not_provided',
  ADD COLUMN IF NOT EXISTS ingredient_statement_updated_at timestamptz;

ALTER TABLE public.instrumental_samples
  DROP CONSTRAINT IF EXISTS instrumental_samples_ingredient_statement_source_check;

ALTER TABLE public.instrumental_samples
  ADD CONSTRAINT instrumental_samples_ingredient_statement_source_check
  CHECK (ingredient_statement_source IN ('not_provided', 'csv_import', 'manual'));

ALTER TABLE public.instrumental_samples
  DROP CONSTRAINT IF EXISTS instrumental_samples_ingredient_statement_length_check;

ALTER TABLE public.instrumental_samples
  ADD CONSTRAINT instrumental_samples_ingredient_statement_length_check
  CHECK (ingredient_statement IS NULL OR char_length(ingredient_statement) <= 10000);

COMMENT ON COLUMN public.instrumental_samples.ingredient_statement IS
  'Exact ingredient statement for this formulation, preserving supplied wording and order.';

COMMENT ON COLUMN public.instrumental_samples.ingredient_statement_source IS
  'How the current ingredient statement entered the platform: not_provided, csv_import, or manual.';

COMMENT ON COLUMN public.instrumental_samples.ingredient_statement_updated_at IS
  'Time the ingredient statement was most recently imported, edited, or cleared.';
