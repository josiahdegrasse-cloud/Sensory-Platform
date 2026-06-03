-- Add missing columns to the responses table that were present in the intended
-- schema but may not have been applied to the live database.
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS comments text;
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS session_type text;
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS sample_code text;
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS different_sample text;
ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS ranking text[];
