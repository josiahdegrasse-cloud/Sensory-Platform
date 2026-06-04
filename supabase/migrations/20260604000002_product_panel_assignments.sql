ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS assigned_panelist_ids text[] DEFAULT '{}';
