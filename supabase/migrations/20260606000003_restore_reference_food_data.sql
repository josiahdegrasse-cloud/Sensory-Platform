UPDATE public.food_types
SET status = 'active',
    updated_at = now()
WHERE slug IN ('cheese', 'bread');

UPDATE public.import_batches
SET status = 'active',
    status_before_archive = NULL,
    archived_at = NULL,
    deleted_at = NULL
WHERE food_type_id IN (
  SELECT id
  FROM public.food_types
  WHERE slug IN ('cheese', 'bread')
);
