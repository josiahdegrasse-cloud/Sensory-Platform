-- Production hardening: authorization, transactional imports, private concept
-- assets, durable decisions, and server-side workspace controls.

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  self_signup_enabled boolean := true;
BEGIN
  SELECT COALESCE(allow_self_signup, true)
  INTO self_signup_enabled
  FROM public.workspace_settings
  WHERE id = true;

  IF NOT self_signup_enabled AND NEW.invited_at IS NULL THEN
    RAISE EXCEPTION 'Self signup is disabled for this workspace';
  END IF;

  INSERT INTO public.profiles (
    id, email, name, role, status, training_level,
    consent_accepted_at, consent_version, consent_user_agent
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    'panelist',
    'active',
    'screened',
    NULLIF(NEW.raw_user_meta_data->>'consent_accepted_at', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'consent_version', ''),
    NULLIF(NEW.raw_user_meta_data->>'consent_user_agent', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    consent_accepted_at = COALESCE(public.profiles.consent_accepted_at, EXCLUDED.consent_accepted_at),
    consent_version = COALESCE(public.profiles.consent_version, EXCLUDED.consent_version),
    consent_user_agent = COALESCE(public.profiles.consent_user_agent, EXCLUDED.consent_user_agent);

  RETURN NEW;
END;
$$;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status_before_archive text,
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft', 'active', 'completed', 'archived'));

ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS status_before_archive text;

CREATE UNIQUE INDEX IF NOT EXISTS import_batches_idempotency_key_key
  ON public.import_batches(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.decision_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id text NOT NULL,
  sample_name text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('GO', 'TWEAK', 'STOP')),
  issf_score numeric NOT NULL CHECK (issf_score BETWEEN 0 AND 100),
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  note text NOT NULL DEFAULT '',
  method_version text NOT NULL,
  decision_fingerprint text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_records_created_at
  ON public.decision_records(created_at DESC);

ALTER TABLE public.decision_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decision_records_admin_select ON public.decision_records;
CREATE POLICY decision_records_admin_select ON public.decision_records
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS decision_records_admin_insert ON public.decision_records;
CREATE POLICY decision_records_admin_insert ON public.decision_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

-- An audit trail is append-only. Corrections are new records, never destructive edits.
REVOKE UPDATE, DELETE ON public.decision_records FROM authenticated;

UPDATE storage.buckets
SET public = false
WHERE id = 'concept-images';

DROP POLICY IF EXISTS "authenticated_view_concept_images" ON storage.objects;
DROP POLICY IF EXISTS "assigned_view_concept_images" ON storage.objects;
CREATE POLICY "assigned_view_concept_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'concept-images'
    AND public.is_active_user()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1
        FROM public.concept_images ci
        JOIN public.concept_tests ct ON ct.id = ci.concept_test_id
        WHERE ci.storage_path = storage.objects.name
          AND ci.selected_for_panelists = true
          AND ct.status = 'active'
          AND ct.assigned_panelist_ids @> ARRAY[auth.uid()::text]
      )
    )
  );

DROP POLICY IF EXISTS concept_tests_select_panelist ON public.concept_tests;
CREATE POLICY concept_tests_select_panelist ON public.concept_tests
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND status = 'active'
    AND assigned_panelist_ids @> ARRAY[auth.uid()::text]
  );

DROP POLICY IF EXISTS products_select_authenticated ON public.products;
CREATE POLICY products_select_authenticated ON public.products
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR (
        status = 'active'
        AND (
          COALESCE(array_length(assigned_panelist_ids, 1), 0) = 0
          OR assigned_panelist_ids @> ARRAY[auth.uid()::text]
        )
      )
    )
  );

DROP POLICY IF EXISTS responses_insert_own ON public.responses;
CREATE POLICY responses_insert_own ON public.responses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.id = product_id
        AND p.status = 'active'
        AND (
          COALESCE(array_length(p.assigned_panelist_ids, 1), 0) = 0
          OR p.assigned_panelist_ids @> ARRAY[auth.uid()::text]
        )
    )
  );

DROP POLICY IF EXISTS concept_responses_insert_own ON public.concept_responses;
CREATE POLICY concept_responses_insert_own ON public.concept_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_user()
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.concept_tests ct
      WHERE ct.id = concept_test_id
        AND ct.status = 'active'
        AND ct.assigned_panelist_ids @> ARRAY[auth.uid()::text]
    )
  );

CREATE OR REPLACE FUNCTION public.create_instrumental_import(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  settings public.workspace_settings%ROWTYPE;
  detection jsonb := COALESCE(payload->'detection', '{}'::jsonb);
  v_food_type_id uuid;
  batch_id uuid;
  sample_row_id uuid;
  actor_id uuid := auth.uid();
  food_slug text := lower(regexp_replace(COALESCE(detection->>'slug', ''), '[^a-z0-9]+', '-', 'g'));
  food_label text := btrim(COALESCE(detection->>'label', ''));
  original_sample_id text;
  resolved_sample_id text;
  sample_name text;
  sample_category text;
  sample_payload jsonb;
  compound jsonb;
  composition jsonb;
  duplicate_number integer;
  product_name text;
  product_status text;
  idempotency_key text := nullif(left(btrim(COALESCE(payload->>'idempotencyKey', '')), 128), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can import instrument data';
  END IF;

  IF jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Import payload must be a JSON object';
  END IF;

  IF food_slug = '' OR food_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
    RAISE EXCEPTION 'A valid detected food type is required';
  END IF;

  IF food_label = '' THEN
    food_label := initcap(replace(food_slug, '-', ' '));
  END IF;

  IF length(COALESCE(payload->>'fileName', '')) > 240 THEN
    RAISE EXCEPTION 'Import name must be 240 characters or fewer';
  END IF;

  SELECT * INTO settings
  FROM public.workspace_settings
  WHERE id = true;

  IF idempotency_key IS NOT NULL THEN
    SELECT id INTO batch_id
    FROM public.import_batches
    WHERE import_batches.idempotency_key = idempotency_key;
    IF batch_id IS NOT NULL THEN
      RETURN batch_id;
    END IF;
  END IF;

  SELECT id INTO v_food_type_id
  FROM public.food_types
  WHERE slug = food_slug;

  IF v_food_type_id IS NULL AND NOT COALESCE(settings.auto_create_food_types, true) THEN
    RAISE EXCEPTION 'Automatic food type creation is disabled';
  END IF;

  INSERT INTO public.food_types (slug, label, status, source, aliases, created_by, updated_at)
  VALUES (
    food_slug,
    food_label,
    'active',
    'import',
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(detection->'aliases', '[]'::jsonb))),
    actor_id,
    now()
  )
  ON CONFLICT (slug) DO UPDATE SET
    status = 'active',
    label = CASE
      WHEN public.food_types.source = 'system' THEN public.food_types.label
      ELSE EXCLUDED.label
    END,
    aliases = ARRAY(
      SELECT DISTINCT alias
      FROM unnest(public.food_types.aliases || EXCLUDED.aliases) AS alias
    ),
    updated_at = now()
  RETURNING id INTO v_food_type_id;

  INSERT INTO public.import_batches (
    food_type_id, file_name, row_count, recognized_columns, ignored_columns,
    detection_confidence, imported_by, idempotency_key
  )
  VALUES (
    v_food_type_id,
    left(COALESCE(NULLIF(btrim(payload->>'fileName'), ''), food_label || ' import'), 240),
    GREATEST(0, COALESCE((payload->>'rowCount')::integer, 0)),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'recognizedColumns', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'ignoredColumns', '[]'::jsonb))),
    LEAST(1, GREATEST(0, COALESCE((detection->>'confidence')::numeric, 0))),
    actor_id,
    idempotency_key
  )
  RETURNING id INTO batch_id;

  FOR original_sample_id IN
    SELECT DISTINCT sample_id
    FROM (
      SELECT btrim(item->>'sampleId') AS sample_id
      FROM jsonb_array_elements(COALESCE(payload->'eTongueData', '[]'::jsonb)) item
      UNION
      SELECT key FROM jsonb_each(COALESCE(payload->'gcmsData', '{}'::jsonb))
      UNION
      SELECT key FROM jsonb_each(COALESCE(payload->'compositionData', '{}'::jsonb))
    ) samples
    WHERE sample_id <> ''
  LOOP
    resolved_sample_id := left(original_sample_id, 120);

    IF EXISTS (
      SELECT 1
      FROM public.instrumental_samples s
      JOIN public.import_batches b ON b.id = s.import_batch_id
      WHERE s.food_type_id = v_food_type_id
        AND s.sample_id = resolved_sample_id
        AND b.status = 'active'
    ) THEN
      IF COALESCE(settings.duplicate_sample_policy, 'skip') = 'skip' THEN
        CONTINUE;
      ELSIF settings.duplicate_sample_policy = 'replace' THEN
        DELETE FROM public.products
        WHERE category = food_label AND source_sample_id = resolved_sample_id;

        DELETE FROM public.instrumental_samples s
        USING public.import_batches b
        WHERE s.import_batch_id = b.id
          AND s.food_type_id = v_food_type_id
          AND s.sample_id = resolved_sample_id
          AND b.status = 'active';
      ELSE
        duplicate_number := 2;
        WHILE EXISTS (
          SELECT 1
          FROM public.instrumental_samples
          WHERE instrumental_samples.food_type_id = v_food_type_id
            AND sample_id = left(original_sample_id, 110) || '-' || duplicate_number
        ) LOOP
          duplicate_number := duplicate_number + 1;
        END LOOP;
        resolved_sample_id := left(original_sample_id, 110) || '-' || duplicate_number;
      END IF;
    END IF;

    SELECT item INTO sample_payload
    FROM jsonb_array_elements(COALESCE(payload->'eTongueData', '[]'::jsonb)) item
    WHERE item->>'sampleId' = original_sample_id
    LIMIT 1;

    sample_name := nullif(left(btrim(COALESCE(sample_payload->>'sampleName', '')), 240), '');
    sample_category := left(COALESCE(NULLIF(btrim(sample_payload->>'category'), ''), food_label), 160);

    INSERT INTO public.instrumental_samples (
      import_batch_id, food_type_id, sample_id, sample_name, category
    )
    VALUES (batch_id, v_food_type_id, resolved_sample_id, sample_name, sample_category)
    RETURNING id INTO sample_row_id;

    IF sample_payload IS NOT NULL THEN
      INSERT INTO public.e_tongue_measurements (
        sample_id, sourness, bitterness, saltiness, umami, sweetness
      )
      VALUES (
        sample_row_id,
        COALESCE((sample_payload->>'sourness')::numeric, 0),
        COALESCE((sample_payload->>'bitterness')::numeric, 0),
        COALESCE((sample_payload->>'saltiness')::numeric, 0),
        COALESCE((sample_payload->>'umami')::numeric, 0),
        COALESCE((sample_payload->>'sweetness')::numeric, 0)
      );
    END IF;

    FOR compound IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(payload->'gcmsData'->original_sample_id, '[]'::jsonb))
    LOOP
      INSERT INTO public.gcms_compounds (
        sample_id, name, concentration, aroma, threshold
      )
      VALUES (
        sample_row_id,
        left(COALESCE(NULLIF(btrim(compound->>'name'), ''), 'Unknown compound'), 240),
        COALESCE((compound->>'concentration')::numeric, 0),
        left(COALESCE(NULLIF(btrim(compound->>'aroma'), ''), 'unknown'), 240),
        COALESCE((compound->>'threshold')::numeric, 0)
      );
    END LOOP;

    composition := payload->'compositionData'->original_sample_id;
    IF composition IS NOT NULL THEN
      INSERT INTO public.composition_profiles (
        sample_id, protein, fat, moisture, ph, salt_content, calcium_mg
      )
      VALUES (
        sample_row_id,
        COALESCE((composition->>'protein')::numeric, 0),
        COALESCE((composition->>'fat')::numeric, 0),
        COALESCE((composition->>'moisture')::numeric, 0),
        COALESCE((composition->>'pH')::numeric, 0),
        COALESCE((composition->>'saltContent')::numeric, 0),
        COALESCE((composition->>'calciumMg')::numeric, 0)
      );
    END IF;

    IF COALESCE(settings.auto_create_surveys_from_imports, true) THEN
      product_name := COALESCE(sample_name || ' (' || resolved_sample_id || ')', resolved_sample_id);
      product_status := CASE WHEN COALESCE(settings.require_import_review, false) THEN 'draft' ELSE 'active' END;

      INSERT INTO public.products (
        name, category, status, custom_attributes, assigned_panelist_ids,
        source_import_batch_id, source_sample_id
      )
      VALUES (
        product_name,
        food_label,
        product_status,
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'customAttributes', '[]'::jsonb))),
        '{}',
        batch_id,
        resolved_sample_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    actor_id,
    'instrumental_import_created',
    'import_batches',
    batch_id,
    jsonb_build_object(
      'foodType', food_slug,
      'fileName', payload->>'fileName',
      'rowCount', payload->>'rowCount',
      'duplicatePolicy', COALESCE(settings.duplicate_sample_policy, 'skip')
    )
  );

  RETURN batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_instrumental_import(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_instrumental_import(jsonb) TO authenticated;
