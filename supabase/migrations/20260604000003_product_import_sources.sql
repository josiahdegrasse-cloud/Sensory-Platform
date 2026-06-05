ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source_import_batch_id uuid REFERENCES public.import_batches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_sample_id text;

CREATE INDEX IF NOT EXISTS idx_products_source_import_batch
  ON public.products (source_import_batch_id);

CREATE INDEX IF NOT EXISTS idx_products_source_sample
  ON public.products (source_sample_id);
