ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS blinded boolean NOT NULL DEFAULT false;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS blind_code text;

ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS presentation_order text[];
