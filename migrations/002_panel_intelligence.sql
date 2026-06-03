-- Panel intelligence: training levels and calibration products
-- Run after 001_initial_schema.sql

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS training_level text NOT NULL DEFAULT 'screened'
    CHECK (training_level IN ('screened', 'trained', 'certified', 'expert'));

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_calibration boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reference_scores jsonb DEFAULT NULL;
