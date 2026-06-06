CREATE OR REPLACE FUNCTION public.set_food_type_status(
  target_slug text,
  next_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_food_type_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can manage food types';
  END IF;
  IF next_status NOT IN ('active', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'Invalid food type status';
  END IF;

  SELECT id
  INTO target_food_type_id
  FROM public.food_types
  WHERE slug = target_slug
  FOR UPDATE;

  IF target_food_type_id IS NULL THEN
    RAISE EXCEPTION 'Food type not found';
  END IF;

  UPDATE public.food_types
  SET status = next_status, updated_at = now()
  WHERE id = target_food_type_id;

  IF next_status = 'archived' THEN
    UPDATE public.import_batches
    SET status_before_archive = status, status = 'archived', archived_at = now()
    WHERE food_type_id = target_food_type_id
      AND status NOT IN ('archived', 'deleted');
  ELSIF next_status = 'active' THEN
    UPDATE public.import_batches
    SET status = COALESCE(status_before_archive, 'active'),
        status_before_archive = NULL,
        archived_at = NULL
    WHERE food_type_id = target_food_type_id
      AND status = 'archived';
  ELSE
    UPDATE public.import_batches
    SET status = 'deleted', status_before_archive = NULL, deleted_at = now()
    WHERE food_type_id = target_food_type_id;
  END IF;

  IF next_status = 'deleted' THEN
    DELETE FROM public.products p
    USING public.import_batches b
    WHERE p.source_import_batch_id = b.id
      AND b.food_type_id = target_food_type_id;
  ELSIF next_status = 'archived' THEN
    UPDATE public.products p
    SET status_before_archive = p.status, status = 'archived'
    FROM public.import_batches b
    WHERE p.source_import_batch_id = b.id
      AND b.food_type_id = target_food_type_id
      AND p.status <> 'archived';
  ELSE
    UPDATE public.products p
    SET status = COALESCE(p.status_before_archive, 'active'),
        status_before_archive = NULL
    FROM public.import_batches b
    WHERE p.source_import_batch_id = b.id
      AND b.food_type_id = target_food_type_id;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    auth.uid(),
    'food_type_status_updated',
    'food_types',
    target_food_type_id,
    jsonb_build_object('slug', target_slug, 'status', next_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_food_type_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_food_type_status(text, text) TO authenticated;
