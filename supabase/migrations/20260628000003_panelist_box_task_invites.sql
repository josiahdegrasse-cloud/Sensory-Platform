-- Convert at-home kit QR invites from one-study links into one box pass per
-- panelist. A claimed box pass assigns the panelist to every food evaluation
-- packed in that shipment, then the app routes them to their task dashboard.

ALTER TABLE public.panelist_kits
  ADD COLUMN IF NOT EXISTS assigned_product_ids uuid[] NOT NULL DEFAULT '{}';

UPDATE public.panelist_kits
SET assigned_product_ids = ARRAY[product_id]
WHERE assigned_product_ids = '{}';

DROP FUNCTION IF EXISTS public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb);
CREATE OR REPLACE FUNCTION public.generate_panelist_kits(
  target_product_id uuid,
  kit_count integer,
  p_expires_at timestamptz DEFAULT NULL,
  p_response_deadline date DEFAULT NULL,
  p_handling_instructions text DEFAULT '',
  p_recipients jsonb DEFAULT '[]'::jsonb,
  p_assigned_product_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  token text,
  kit_code text,
  manual_code text,
  sample_code text,
  product_id uuid,
  assigned_product_ids uuid[],
  status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  recipient_name text,
  recipient_email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_product record;
  v_existing integer := 0;
  v_i integer;
  v_token text;
  v_manual_code text;
  v_sample_code text;
  v_inserted public.panelist_kits%ROWTYPE;
  v_recipient jsonb;
  v_recipient_count integer := COALESCE(jsonb_array_length(p_recipients), 0);
  v_recipient_name text;
  v_recipient_email text;
  v_assigned_products uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can generate panelist box passes';
  END IF;
  IF kit_count < 1 OR kit_count > 250 THEN
    RAISE EXCEPTION 'kit_count must be between 1 and 250';
  END IF;

  SELECT p.id, p.org_id, p.name, p.blind_code
  INTO v_product
  FROM public.products p
  WHERE p.id = target_product_id
    AND p.org_id = v_org;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product not found for this workspace';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT product_id), ARRAY[target_product_id])
  INTO v_assigned_products
  FROM unnest(COALESCE(NULLIF(p_assigned_product_ids, ARRAY[]::uuid[]), ARRAY[target_product_id])) AS selected(product_id)
  JOIN public.products p ON p.id = selected.product_id
  WHERE p.org_id = v_org
    AND p.status = 'active';

  IF v_assigned_products IS NULL OR cardinality(v_assigned_products) = 0 THEN
    v_assigned_products := ARRAY[target_product_id];
  END IF;

  SELECT count(*) INTO v_existing
  FROM public.panelist_kits k
  WHERE k.org_id = v_org
    AND k.product_id = target_product_id;

  FOR v_i IN 1..kit_count LOOP
    v_token := regexp_replace(
      replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
      '=+$',
      ''
    );
    LOOP
      v_manual_code := public.generate_panelist_kit_manual_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.panelist_kits WHERE manual_code = v_manual_code);
    END LOOP;
    v_sample_code := COALESCE(v_product.blind_code, 'BOX-' || lpad((v_existing + v_i)::text, 3, '0'));
    v_recipient := CASE WHEN v_i <= v_recipient_count THEN p_recipients -> (v_i - 1) ELSE NULL END;
    v_recipient_name := NULLIF(trim(COALESCE(v_recipient->>'name', '')), '');
    v_recipient_email := lower(NULLIF(trim(COALESCE(v_recipient->>'email', '')), ''));

    INSERT INTO public.panelist_kits (
      org_id, product_id, assigned_product_ids, kit_code, manual_code, sample_code, token_hash,
      expires_at, response_deadline, handling_instructions,
      recipient_name, recipient_email, created_by
    )
    VALUES (
      v_org,
      target_product_id,
      v_assigned_products,
      'BOX-' || lpad((v_existing + v_i)::text, 3, '0'),
      v_manual_code,
      v_sample_code,
      public.panelist_kit_token_hash(v_token),
      p_expires_at,
      p_response_deadline,
      COALESCE(p_handling_instructions, ''),
      v_recipient_name,
      v_recipient_email,
      auth.uid()
    )
    RETURNING * INTO v_inserted;

    PERFORM public.record_panelist_kit_event(
      v_inserted.id,
      'generated',
      jsonb_build_object('kit_code', v_inserted.kit_code, 'assigned_product_count', cardinality(v_assigned_products))
    );

    id := v_inserted.id;
    token := v_token;
    kit_code := v_inserted.kit_code;
    manual_code := v_inserted.manual_code;
    sample_code := v_inserted.sample_code;
    product_id := v_inserted.product_id;
    assigned_product_ids := v_inserted.assigned_product_ids;
    status := v_inserted.status;
    expires_at := v_inserted.expires_at;
    response_deadline := v_inserted.response_deadline;
    handling_instructions := v_inserted.handling_instructions;
    recipient_name := v_inserted.recipient_name;
    recipient_email := v_inserted.recipient_email;
    created_at := v_inserted.created_at;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb, uuid[]) TO authenticated;

DROP FUNCTION IF EXISTS public.list_panelist_kits(uuid);
CREATE OR REPLACE FUNCTION public.list_panelist_kits(target_product_id uuid)
RETURNS TABLE (
  id uuid,
  kit_code text,
  manual_code text,
  sample_code text,
  product_id uuid,
  assigned_product_ids uuid[],
  assigned_product_count integer,
  completed_product_count bigint,
  product_name text,
  calculated_status text,
  stored_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  recipient_name text,
  recipient_email text,
  printed_at timestamptz,
  packed_at timestamptz,
  shipped_at timestamptz,
  tracking_number text,
  issue_type text,
  issue_note text,
  issue_status text,
  issue_reported_at timestamptz,
  voided_at timestamptz,
  void_reason text,
  replacement_for_kit_id uuid,
  claimed_by uuid,
  claimed_panelist_name text,
  claimed_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  reminder_count bigint,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    k.id,
    k.kit_code,
    k.manual_code,
    k.sample_code,
    k.product_id,
    k.assigned_product_ids,
    cardinality(k.assigned_product_ids) AS assigned_product_count,
    COALESCE(done.completed_product_count, 0) AS completed_product_count,
    p.name AS product_name,
    CASE
      WHEN k.submitted_at IS NOT NULL
        OR (
          cardinality(k.assigned_product_ids) > 0
          AND COALESCE(done.completed_product_count, 0) >= cardinality(k.assigned_product_ids)
        ) THEN 'submitted'
      WHEN k.expires_at IS NOT NULL AND k.expires_at < now() THEN 'expired'
      ELSE k.status
    END AS calculated_status,
    k.status AS stored_status,
    k.expires_at,
    k.response_deadline,
    k.handling_instructions,
    k.recipient_name,
    k.recipient_email,
    k.printed_at,
    k.packed_at,
    k.shipped_at,
    k.tracking_number,
    k.issue_type,
    k.issue_note,
    k.issue_status,
    k.issue_reported_at,
    k.voided_at,
    k.void_reason,
    k.replacement_for_kit_id,
    k.claimed_by,
    pr.name AS claimed_panelist_name,
    k.claimed_at,
    k.started_at,
    COALESCE(k.submitted_at, done.latest_submitted_at) AS submitted_at,
    COALESCE(ev.reminder_count, 0) AS reminder_count,
    k.created_at
  FROM public.panelist_kits k
  JOIN public.products p ON p.id = k.product_id
  LEFT JOIN public.profiles pr ON pr.id = k.claimed_by
  LEFT JOIN LATERAL (
    SELECT count(DISTINCT res.product_id) AS completed_product_count,
           max(res.created_at) AS latest_submitted_at
    FROM public.responses res
    WHERE res.product_id = ANY(k.assigned_product_ids)
      AND res.user_id = k.claimed_by
  ) done ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS reminder_count
    FROM public.panelist_kit_events e
    WHERE e.kit_id = k.id AND e.event_type = 'reminder_sent'
  ) ev ON true
  WHERE k.product_id = target_product_id
    AND k.org_id = public.current_org_id()
    AND public.is_admin()
  ORDER BY k.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_panelist_kits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_panelist_kits(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.get_panelist_kit_by_token(text);
CREATE OR REPLACE FUNCTION public.get_panelist_kit_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  product_id uuid,
  assigned_product_ids uuid[],
  assigned_product_count integer,
  product_name text,
  product_category text,
  is_multi_sample boolean,
  sample_code text,
  kit_code text,
  manual_code text,
  calculated_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  issue_type text,
  issue_note text,
  issue_status text,
  claimed_by uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    k.id,
    k.org_id,
    k.product_id,
    k.assigned_product_ids,
    cardinality(k.assigned_product_ids) AS assigned_product_count,
    p.name AS product_name,
    p.category AS product_category,
    COALESCE(p.is_multi_sample, false) AS is_multi_sample,
    k.sample_code,
    k.kit_code,
    k.manual_code,
    CASE
      WHEN k.submitted_at IS NOT NULL THEN 'submitted'
      WHEN k.expires_at IS NOT NULL AND k.expires_at < now() THEN 'expired'
      ELSE k.status
    END AS calculated_status,
    k.expires_at,
    k.response_deadline,
    k.handling_instructions,
    k.issue_type,
    k.issue_note,
    k.issue_status,
    k.claimed_by
  FROM public.panelist_kits k
  JOIN public.products p ON p.id = k.product_id
  JOIN public.organizations o ON o.id = k.org_id AND o.status = 'active'
  WHERE k.token_hash = public.panelist_kit_token_hash(p_token)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_panelist_kit_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_panelist_kit_by_token(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_panelist_kit_by_manual_code(text);
CREATE OR REPLACE FUNCTION public.get_panelist_kit_by_manual_code(p_manual_code text)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  product_id uuid,
  assigned_product_ids uuid[],
  assigned_product_count integer,
  product_name text,
  product_category text,
  is_multi_sample boolean,
  sample_code text,
  kit_code text,
  manual_code text,
  calculated_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  issue_type text,
  issue_note text,
  issue_status text,
  claimed_by uuid
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    k.id,
    k.org_id,
    k.product_id,
    k.assigned_product_ids,
    cardinality(k.assigned_product_ids) AS assigned_product_count,
    p.name AS product_name,
    p.category AS product_category,
    COALESCE(p.is_multi_sample, false) AS is_multi_sample,
    k.sample_code,
    k.kit_code,
    k.manual_code,
    CASE
      WHEN k.submitted_at IS NOT NULL THEN 'submitted'
      WHEN k.expires_at IS NOT NULL AND k.expires_at < now() THEN 'expired'
      ELSE k.status
    END AS calculated_status,
    k.expires_at,
    k.response_deadline,
    k.handling_instructions,
    k.issue_type,
    k.issue_note,
    k.issue_status,
    k.claimed_by
  FROM public.panelist_kits k
  JOIN public.products p ON p.id = k.product_id
  JOIN public.organizations o ON o.id = k.org_id AND o.status = 'active'
  WHERE upper(k.manual_code) = upper(trim(p_manual_code))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_panelist_kit_by_manual_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_panelist_kit_by_manual_code(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.claim_panelist_kit(text, text);
CREATE OR REPLACE FUNCTION public.claim_panelist_kit(p_token text DEFAULT NULL, p_manual_code text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  product_id uuid,
  assigned_product_ids uuid[],
  assigned_product_count integer,
  product_name text,
  product_category text,
  is_multi_sample boolean,
  sample_code text,
  kit_code text,
  manual_code text,
  calculated_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  issue_type text,
  issue_note text,
  issue_status text,
  claimed_by uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_kit public.panelist_kits%ROWTYPE;
  v_profile_org uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to claim this box pass';
  END IF;

  SELECT * INTO v_kit
  FROM public.panelist_kits
  WHERE (p_token IS NOT NULL AND token_hash = public.panelist_kit_token_hash(p_token))
     OR (p_manual_code IS NOT NULL AND upper(manual_code) = upper(trim(p_manual_code)))
  FOR UPDATE;

  IF v_kit.id IS NULL THEN
    RAISE EXCEPTION 'This box pass link or code is invalid';
  END IF;
  IF v_kit.expires_at IS NOT NULL AND v_kit.expires_at < now() THEN
    UPDATE public.panelist_kits
    SET status = 'expired', updated_at = now()
    WHERE id = v_kit.id;
    PERFORM public.record_panelist_kit_event(v_kit.id, 'expired', '{}'::jsonb);
    RAISE EXCEPTION 'This box pass has expired';
  END IF;
  IF v_kit.status IN ('void', 'submitted') THEN
    RAISE EXCEPTION 'This box pass is no longer available';
  END IF;
  IF v_kit.claimed_by IS NOT NULL AND v_kit.claimed_by <> v_uid THEN
    RAISE EXCEPTION 'This box pass has already been claimed';
  END IF;

  SELECT org_id INTO v_profile_org FROM public.profiles WHERE id = v_uid;
  IF v_profile_org IS NOT NULL AND v_profile_org <> v_kit.org_id THEN
    RAISE EXCEPTION 'This account belongs to a different workspace';
  END IF;

  UPDATE public.profiles
  SET org_id = v_kit.org_id,
      status = 'active',
      role = 'panelist'
  WHERE id = v_uid;

  UPDATE public.panelist_kits
  SET claimed_by = v_uid,
      claimed_at = COALESCE(claimed_at, now()),
      status = CASE WHEN status IN ('generated', 'printed', 'packed', 'shipped') THEN 'claimed' ELSE status END,
      updated_at = now()
  WHERE id = v_kit.id;

  UPDATE public.products p
  SET assigned_panelist_ids = CASE
    WHEN p.assigned_panelist_ids @> ARRAY[v_uid::text] THEN p.assigned_panelist_ids
    ELSE array_append(COALESCE(p.assigned_panelist_ids, ARRAY[]::text[]), v_uid::text)
  END
  WHERE p.id = ANY(COALESCE(NULLIF(v_kit.assigned_product_ids, ARRAY[]::uuid[]), ARRAY[v_kit.product_id]))
    AND p.org_id = v_kit.org_id
    AND p.status = 'active';

  PERFORM public.record_panelist_kit_event(
    v_kit.id,
    'claimed',
    jsonb_build_object('user_id', v_uid, 'assigned_product_count', cardinality(v_kit.assigned_product_ids))
  );

  IF p_token IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.get_panelist_kit_by_token(p_token);
  ELSE
    RETURN QUERY SELECT * FROM public.get_panelist_kit_by_manual_code(p_manual_code);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_panelist_kit(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_panelist_kit(text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.create_replacement_panelist_kit(uuid, text);
CREATE OR REPLACE FUNCTION public.create_replacement_panelist_kit(target_kit_id uuid, p_reason text DEFAULT '')
RETURNS TABLE (
  id uuid,
  token text,
  kit_code text,
  manual_code text,
  sample_code text,
  product_id uuid,
  assigned_product_ids uuid[],
  status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  recipient_name text,
  recipient_email text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_source public.panelist_kits%ROWTYPE;
  v_existing integer;
  v_token text;
  v_manual_code text;
  v_inserted public.panelist_kits%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create replacement box passes';
  END IF;

  SELECT * INTO v_source
  FROM public.panelist_kits
  WHERE id = target_kit_id
    AND org_id = public.current_org_id();

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Box pass not found';
  END IF;

  PERFORM public.void_panelist_kit(target_kit_id, COALESCE(NULLIF(p_reason, ''), 'Replacement issued'));

  SELECT count(*) INTO v_existing
  FROM public.panelist_kits
  WHERE org_id = v_source.org_id
    AND product_id = v_source.product_id;

  v_token := regexp_replace(
    replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
    '=+$',
    ''
  );
  LOOP
    v_manual_code := public.generate_panelist_kit_manual_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.panelist_kits WHERE manual_code = v_manual_code);
  END LOOP;

  INSERT INTO public.panelist_kits (
    org_id, product_id, assigned_product_ids, kit_code, manual_code, sample_code, token_hash,
    expires_at, response_deadline, handling_instructions, recipient_name,
    recipient_email, replacement_for_kit_id, created_by
  )
  VALUES (
    v_source.org_id,
    v_source.product_id,
    v_source.assigned_product_ids,
    'BOX-' || lpad((v_existing + 1)::text, 3, '0'),
    v_manual_code,
    v_source.sample_code,
    public.panelist_kit_token_hash(v_token),
    v_source.expires_at,
    v_source.response_deadline,
    v_source.handling_instructions,
    v_source.recipient_name,
    v_source.recipient_email,
    v_source.id,
    auth.uid()
  )
  RETURNING * INTO v_inserted;

  PERFORM public.record_panelist_kit_event(v_inserted.id, 'replacement_created', jsonb_build_object('replacement_for', v_source.id, 'reason', p_reason));

  id := v_inserted.id;
  token := v_token;
  kit_code := v_inserted.kit_code;
  manual_code := v_inserted.manual_code;
  sample_code := v_inserted.sample_code;
  product_id := v_inserted.product_id;
  assigned_product_ids := v_inserted.assigned_product_ids;
  status := v_inserted.status;
  expires_at := v_inserted.expires_at;
  response_deadline := v_inserted.response_deadline;
  handling_instructions := v_inserted.handling_instructions;
  recipient_name := v_inserted.recipient_name;
  recipient_email := v_inserted.recipient_email;
  created_at := v_inserted.created_at;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.create_replacement_panelist_kit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_replacement_panelist_kit(uuid, text) TO authenticated;
