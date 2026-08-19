-- Store formulation-level means for arbitrary instrumental columns while
-- preserving the existing specialised e-tongue, GC-MS, and composition paths.

CREATE TABLE public.instrumental_measurement_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id uuid NOT NULL UNIQUE REFERENCES public.instrumental_samples(id) ON DELETE CASCADE,
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(metrics) = 'array'),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_instrumental_measurement_profiles_org
  ON public.instrumental_measurement_profiles(org_id);

ALTER TABLE public.instrumental_measurement_profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_set_org_id
  BEFORE INSERT ON public.instrumental_measurement_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

CREATE POLICY instrumental_measurement_profiles_select_authenticated
  ON public.instrumental_measurement_profiles
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND EXISTS (
      SELECT 1
      FROM public.instrumental_samples s
      JOIN public.import_batches b ON b.id = s.import_batch_id
      WHERE s.id = instrumental_measurement_profiles.sample_id
        AND (b.status = 'active' OR public.is_admin())
    )
  );

CREATE POLICY instrumental_measurement_profiles_admin_all
  ON public.instrumental_measurement_profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY instrumental_measurement_profiles_org_isolation
  ON public.instrumental_measurement_profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

CREATE OR REPLACE FUNCTION public.create_instrumental_import(payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_org uuid := public.current_org_id();
  settings public.workspace_settings%ROWTYPE;
  detection jsonb := COALESCE(payload->'detection', '{}'::jsonb);
  v_food_type_id uuid;
  v_project_id uuid;
  batch_id uuid;
  sample_row_id uuid;
  actor_id uuid := auth.uid();
  food_slug text := lower(regexp_replace(COALESCE(detection->>'slug', ''), '[^a-z0-9]+', '-', 'g'));
  food_label text := btrim(COALESCE(detection->>'label', ''));
  import_name text;
  original_sample_id text;
  resolved_sample_id text;
  sample_name text;
  sample_category text;
  sample_payload jsonb;
  compound jsonb;
  composition jsonb;
  measurement_metrics jsonb;
  duplicate_number integer;
  product_name text;
  product_status text;
  v_idempotency_key text := nullif(left(btrim(COALESCE(payload->>'idempotencyKey', '')), 128), '');
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can import instrument data';
  END IF;

  IF caller_org IS NULL THEN
    RAISE EXCEPTION 'No organization context for instrument import';
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

  import_name := left(COALESCE(NULLIF(btrim(payload->>'fileName'), ''), food_label || ' import'), 240);

  SELECT * INTO settings
  FROM public.workspace_settings
  WHERE org_id = caller_org;

  IF v_idempotency_key IS NOT NULL THEN
    SELECT b.id INTO batch_id
    FROM public.import_batches b
    WHERE b.org_id = caller_org
      AND b.idempotency_key = v_idempotency_key
      AND b.status = 'active';
    IF batch_id IS NOT NULL THEN
      RETURN batch_id;
    END IF;
  END IF;

  SELECT ft.id INTO v_food_type_id
  FROM public.food_types ft
  WHERE ft.slug = food_slug
    AND (ft.org_id = caller_org OR ft.org_id IS NULL)
  ORDER BY (ft.org_id = caller_org) DESC
  LIMIT 1;

  IF v_food_type_id IS NULL AND NOT COALESCE(settings.auto_create_food_types, true) THEN
    RAISE EXCEPTION 'Automatic food type creation is disabled';
  END IF;

  IF v_food_type_id IS NULL THEN
    INSERT INTO public.food_types (
      slug, label, status, source, aliases, created_by, updated_at, org_id
    )
    VALUES (
      food_slug,
      food_label,
      'active',
      'import',
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(detection->'aliases', '[]'::jsonb))),
      actor_id,
      now(),
      caller_org
    )
    RETURNING id INTO v_food_type_id;
  ELSE
    UPDATE public.food_types
    SET
      status = 'active',
      label = food_label,
      aliases = ARRAY(
        SELECT DISTINCT alias
        FROM unnest(
          public.food_types.aliases ||
          ARRAY(SELECT jsonb_array_elements_text(COALESCE(detection->'aliases', '[]'::jsonb)))
        ) AS alias
      ),
      updated_at = now()
    WHERE id = v_food_type_id
      AND org_id = caller_org
      AND source <> 'system';
  END IF;

  INSERT INTO public.projects (
    name, food_type_id, started_at, created_by, org_id
  )
  VALUES (
    import_name,
    v_food_type_id,
    now(),
    actor_id,
    caller_org
  )
  RETURNING id INTO v_project_id;

  INSERT INTO public.import_batches (
    food_type_id, file_name, row_count, recognized_columns, ignored_columns,
    detection_confidence, imported_by, idempotency_key, project_id, org_id
  )
  VALUES (
    v_food_type_id,
    import_name,
    GREATEST(0, COALESCE((payload->>'rowCount')::integer, 0)),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'recognizedColumns', '[]'::jsonb))),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(payload->'ignoredColumns', '[]'::jsonb))),
    LEAST(1, GREATEST(0, COALESCE((detection->>'confidence')::numeric, 0))),
    actor_id,
    v_idempotency_key,
    v_project_id,
    caller_org
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
      WHERE b.org_id = caller_org
        AND s.food_type_id = v_food_type_id
        AND s.sample_id = resolved_sample_id
        AND b.status = 'active'
    ) THEN
      IF COALESCE(settings.duplicate_sample_policy, 'skip') = 'skip' THEN
        CONTINUE;
      ELSIF settings.duplicate_sample_policy = 'replace' THEN
        DELETE FROM public.products
        WHERE org_id = caller_org
          AND category = food_label
          AND source_sample_id = resolved_sample_id;

        DELETE FROM public.instrumental_samples s
        USING public.import_batches b
        WHERE b.org_id = caller_org
          AND s.import_batch_id = b.id
          AND s.food_type_id = v_food_type_id
          AND s.sample_id = resolved_sample_id
          AND b.status = 'active';
      ELSE
        duplicate_number := 2;
        WHILE EXISTS (
          SELECT 1
          FROM public.instrumental_samples s
          WHERE s.org_id = caller_org
            AND s.food_type_id = v_food_type_id
            AND s.sample_id = left(original_sample_id, 110) || '-' || duplicate_number
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
      import_batch_id, food_type_id, project_id, sample_id, sample_name, category, org_id
    )
    VALUES (
      batch_id, v_food_type_id, v_project_id, resolved_sample_id, sample_name, sample_category, caller_org
    )
    RETURNING id INTO sample_row_id;

    IF sample_payload IS NOT NULL
       AND COALESCE((sample_payload->>'hasETongueData')::boolean, true) THEN
      INSERT INTO public.e_tongue_measurements (
        sample_id, sourness, bitterness, saltiness, umami, sweetness, org_id
      )
      VALUES (
        sample_row_id,
        COALESCE((sample_payload->>'sourness')::numeric, 0),
        COALESCE((sample_payload->>'bitterness')::numeric, 0),
        COALESCE((sample_payload->>'saltiness')::numeric, 0),
        COALESCE((sample_payload->>'umami')::numeric, 0),
        COALESCE((sample_payload->>'sweetness')::numeric, 0),
        caller_org
      );
    END IF;

    FOR compound IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(payload->'gcmsData'->original_sample_id, '[]'::jsonb))
    LOOP
      INSERT INTO public.gcms_compounds (
        sample_id, name, concentration, aroma, threshold, org_id
      )
      VALUES (
        sample_row_id,
        left(COALESCE(NULLIF(btrim(compound->>'name'), ''), 'Unknown compound'), 240),
        COALESCE((compound->>'concentration')::numeric, 0),
        left(COALESCE(NULLIF(btrim(compound->>'aroma'), ''), 'unknown'), 240),
        COALESCE((compound->>'threshold')::numeric, 0),
        caller_org
      );
    END LOOP;

    composition := payload->'compositionData'->original_sample_id;
    IF composition IS NOT NULL THEN
      INSERT INTO public.composition_profiles (
        sample_id, protein, fat, moisture, ph, salt_content, calcium_mg, org_id
      )
      VALUES (
        sample_row_id,
        COALESCE((composition->>'protein')::numeric, 0),
        COALESCE((composition->>'fat')::numeric, 0),
        COALESCE((composition->>'moisture')::numeric, 0),
        COALESCE((composition->>'pH')::numeric, 0),
        COALESCE((composition->>'saltContent')::numeric, 0),
        COALESCE((composition->>'calciumMg')::numeric, 0),
        caller_org
      );
    END IF;

    measurement_metrics := sample_payload->'measurements';
    IF jsonb_typeof(measurement_metrics) = 'array'
       AND jsonb_array_length(measurement_metrics) > 0 THEN
      INSERT INTO public.instrumental_measurement_profiles (
        sample_id, metrics, org_id
      )
      VALUES (
        sample_row_id, measurement_metrics, caller_org
      );
    END IF;

    IF COALESCE(settings.auto_create_surveys_from_imports, true) THEN
      product_name := COALESCE(sample_name || ' (' || resolved_sample_id || ')', resolved_sample_id);
      product_status := CASE WHEN COALESCE(settings.require_import_review, false) THEN 'draft' ELSE 'active' END;

      INSERT INTO public.products (
        name, category, status, custom_attributes, assigned_panelist_ids,
        source_import_batch_id, source_sample_id, project_id, org_id
      )
      VALUES (
        product_name,
        food_label,
        product_status,
        COALESCE(payload->'customAttributes', '[]'::jsonb),
        '{}',
        batch_id,
        resolved_sample_id,
        v_project_id,
        caller_org
      );
    END IF;
  END LOOP;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, metadata, org_id
  )
  VALUES (
    actor_id,
    'instrumental_import_created',
    'import_batches',
    batch_id,
    jsonb_build_object(
      'foodType', food_slug,
      'fileName', import_name,
      'rowCount', payload->>'rowCount',
      'duplicatePolicy', COALESCE(settings.duplicate_sample_policy, 'skip'),
      'projectId', v_project_id
    ),
    caller_org
  );

  RETURN batch_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_instrumental_import(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_instrumental_import(jsonb) TO authenticated;
