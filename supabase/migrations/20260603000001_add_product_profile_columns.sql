-- Add training_level to profiles (used by panelist metrics / training tier logic)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS training_level text NOT NULL DEFAULT 'screened'
  CHECK (training_level IN ('screened', 'trained', 'certified', 'expert'));

-- Add calibration and blind-study columns to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_calibration boolean NOT NULL DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS reference_scores jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS blinded boolean NOT NULL DEFAULT false;
