-- Require active accounts for every authenticated read path. The UI signing a
-- user out is not an authorization boundary.

DROP POLICY IF EXISTS responses_select_own ON public.responses;
CREATE POLICY responses_select_own ON public.responses
  FOR SELECT TO authenticated
  USING (public.is_active_user() AND auth.uid() = user_id);

DROP POLICY IF EXISTS responses_update_own ON public.responses;
CREATE POLICY responses_update_own ON public.responses
  FOR UPDATE TO authenticated
  USING (public.is_active_user() AND auth.uid() = user_id)
  WITH CHECK (public.is_active_user() AND auth.uid() = user_id);

DROP POLICY IF EXISTS templates_select_authenticated ON public.templates;
CREATE POLICY templates_select_authenticated ON public.templates
  FOR SELECT TO authenticated
  USING (public.is_active_user());

DROP POLICY IF EXISTS concept_responses_select_own ON public.concept_responses;
CREATE POLICY concept_responses_select_own ON public.concept_responses
  FOR SELECT TO authenticated
  USING (public.is_active_user() AND auth.uid() = user_id);

DROP POLICY IF EXISTS concept_responses_update_own ON public.concept_responses;
CREATE POLICY concept_responses_update_own ON public.concept_responses
  FOR UPDATE TO authenticated
  USING (public.is_active_user() AND auth.uid() = user_id)
  WITH CHECK (public.is_active_user() AND auth.uid() = user_id);

DROP POLICY IF EXISTS food_types_select_authenticated ON public.food_types;
CREATE POLICY food_types_select_authenticated ON public.food_types
  FOR SELECT TO authenticated
  USING (public.is_active_user() AND (status = 'active' OR public.is_admin()));

DROP POLICY IF EXISTS import_batches_select_authenticated ON public.import_batches;
CREATE POLICY import_batches_select_authenticated ON public.import_batches
  FOR SELECT TO authenticated
  USING (public.is_active_user() AND (status = 'active' OR public.is_admin()));

DROP POLICY IF EXISTS instrumental_samples_select_authenticated ON public.instrumental_samples;
CREATE POLICY instrumental_samples_select_authenticated ON public.instrumental_samples
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.import_batches b
      WHERE b.id = import_batch_id AND (b.status = 'active' OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS e_tongue_select_authenticated ON public.e_tongue_measurements;
CREATE POLICY e_tongue_select_authenticated ON public.e_tongue_measurements
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.instrumental_samples s
      JOIN public.import_batches b ON b.id = s.import_batch_id
      WHERE s.id = e_tongue_measurements.sample_id
        AND (b.status = 'active' OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS gcms_select_authenticated ON public.gcms_compounds;
CREATE POLICY gcms_select_authenticated ON public.gcms_compounds
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.instrumental_samples s
      JOIN public.import_batches b ON b.id = s.import_batch_id
      WHERE s.id = gcms_compounds.sample_id
        AND (b.status = 'active' OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS composition_select_authenticated ON public.composition_profiles;
CREATE POLICY composition_select_authenticated ON public.composition_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.instrumental_samples s
      JOIN public.import_batches b ON b.id = s.import_batch_id
      WHERE s.id = composition_profiles.sample_id
        AND (b.status = 'active' OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS concept_images_select_authenticated ON public.concept_images;
CREATE POLICY concept_images_select_authenticated ON public.concept_images
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.concept_tests ct
        WHERE ct.id = concept_images.concept_test_id
          AND ct.status = 'active'
          AND concept_images.selected_for_panelists = true
          AND ct.assigned_panelist_ids @> ARRAY[auth.uid()::text]
      )
    )
  );

CREATE OR REPLACE FUNCTION public.set_import_batch_status(
  target_batch_id uuid,
  next_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can manage import batches';
  END IF;
  IF next_status NOT IN ('active', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'Invalid import batch status';
  END IF;

  IF next_status = 'archived' THEN
    UPDATE public.import_batches
    SET status_before_archive = status, status = 'archived', archived_at = now(), deleted_at = NULL
    WHERE id = target_batch_id AND status <> 'archived';
  ELSIF next_status = 'active' THEN
    UPDATE public.import_batches
    SET status = COALESCE(status_before_archive, 'active'),
        status_before_archive = NULL,
        archived_at = NULL,
        deleted_at = NULL
    WHERE id = target_batch_id;
  ELSE
    UPDATE public.import_batches
    SET status = 'deleted', status_before_archive = NULL, deleted_at = now()
    WHERE id = target_batch_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Import batch not found';
  END IF;

  IF next_status = 'deleted' THEN
    DELETE FROM public.products
    WHERE source_import_batch_id = target_batch_id;
  ELSIF next_status = 'archived' THEN
    UPDATE public.products
    SET status_before_archive = status, status = 'archived'
    WHERE source_import_batch_id = target_batch_id
      AND status <> 'archived';
  ELSE
    UPDATE public.products
    SET status = COALESCE(status_before_archive, 'active'), status_before_archive = NULL
    WHERE source_import_batch_id = target_batch_id;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    auth.uid(),
    'import_batch_status_updated',
    'import_batches',
    target_batch_id,
    jsonb_build_object('status', next_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_import_batch_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_import_batch_status(uuid, text) TO authenticated;

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
  target_source text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can manage food types';
  END IF;
  IF next_status NOT IN ('active', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'Invalid food type status';
  END IF;

  SELECT id, source
  INTO target_food_type_id, target_source
  FROM public.food_types
  WHERE slug = target_slug
  FOR UPDATE;

  IF target_food_type_id IS NULL THEN
    RAISE EXCEPTION 'Food type not found';
  END IF;
  IF next_status = 'deleted' AND target_source = 'system' THEN
    RAISE EXCEPTION 'System food types cannot be deleted';
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
    SET status = COALESCE(p.status_before_archive, 'active'), status_before_archive = NULL
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

CREATE OR REPLACE FUNCTION public.get_public_workspace_config()
RETURNS TABLE (
  workspace_name text,
  allow_self_signup boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT ws.workspace_name, ws.allow_self_signup
  FROM public.workspace_settings ws
  WHERE ws.id = true
$$;

REVOKE ALL ON FUNCTION public.get_public_workspace_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_workspace_config() TO anon, authenticated;
