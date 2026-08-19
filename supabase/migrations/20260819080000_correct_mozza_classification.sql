-- Correct imports created before "mozza" was recognised as mozzarella.
-- The project and food type were already cheese; only the sample-facing
-- category inherited the overly broad legacy M-prefix fallback.

UPDATE public.products AS product
SET category = 'Mozzarella'
FROM public.instrumental_samples AS sample
JOIN public.food_types AS food_type
  ON food_type.id = sample.food_type_id
WHERE product.instrumental_sample_id = sample.id
  AND food_type.slug = 'cheese'
  AND lower(product.category) = 'meat'
  AND lower(COALESCE(sample.sample_name, sample.sample_id)) ~ '(^|[^a-z])mozza(rella)?([^a-z]|$)';

UPDATE public.instrumental_samples AS sample
SET category = 'Mozzarella'
FROM public.food_types AS food_type
WHERE food_type.id = sample.food_type_id
  AND food_type.slug = 'cheese'
  AND lower(sample.category) = 'meat'
  AND lower(COALESCE(sample.sample_name, sample.sample_id)) ~ '(^|[^a-z])mozza(rella)?([^a-z]|$)';
