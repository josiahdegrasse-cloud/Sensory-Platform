-- Fix PL/pgSQL output-column variables shadowing table columns in the
-- panelist-box RPCs. Signatures, permissions, and business behavior remain
-- unchanged; every database column used inside procedural SQL is qualified.

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
  FROM public.products AS p
  WHERE p.id = target_product_id
    AND p.org_id = v_org;

  IF v_product.id IS NULL THEN
    RAISE EXCEPTION 'Product not found for this workspace';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT selected.product_id), ARRAY[target_product_id])
  INTO v_assigned_products
  FROM unnest(COALESCE(NULLIF(p_assigned_product_ids, ARRAY[]::uuid[]), ARRAY[target_product_id])) AS selected(product_id)
  JOIN public.products AS p ON p.id = selected.product_id
  WHERE p.org_id = v_org
    AND p.status = 'active';

  IF v_assigned_products IS NULL OR cardinality(v_assigned_products) = 0 THEN
    v_assigned_products := ARRAY[target_product_id];
  END IF;

  SELECT count(*) INTO v_existing
  FROM public.panelist_kits AS k
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
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM public.panelist_kits AS existing_kit
        WHERE existing_kit.manual_code = v_manual_code
      );
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
  issue_status text,
  claimed_by_current_user boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_kit public.panelist_kits%ROWTYPE;
  v_profile_org uuid;
  v_profile_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to claim this box pass';
  END IF;

  SELECT k.* INTO v_kit
  FROM public.panelist_kits AS k
  WHERE (p_token IS NOT NULL AND k.token_hash = public.panelist_kit_token_hash(p_token))
     OR (p_manual_code IS NOT NULL AND upper(k.manual_code) = upper(trim(p_manual_code)))
  FOR UPDATE OF k;

  IF v_kit.id IS NULL THEN
    RAISE EXCEPTION 'This box pass link or code is invalid';
  END IF;
  IF v_kit.expires_at IS NOT NULL AND v_kit.expires_at < now() THEN
    UPDATE public.panelist_kits AS k
    SET status = 'expired', updated_at = now()
    WHERE k.id = v_kit.id;
    PERFORM public.record_panelist_kit_event(v_kit.id, 'expired', '{}'::jsonb);
    RAISE EXCEPTION 'This box pass has expired';
  END IF;
  IF v_kit.status IN ('void', 'submitted') THEN
    RAISE EXCEPTION 'This box pass is no longer available';
  END IF;
  IF v_kit.claimed_by IS NOT NULL AND v_kit.claimed_by <> v_uid THEN
    RAISE EXCEPTION 'This box pass has already been claimed';
  END IF;

  SELECT p.org_id, lower(COALESCE(p.email, u.email))
  INTO v_profile_org, v_profile_email
  FROM public.profiles AS p
  LEFT JOIN auth.users AS u ON u.id = p.id
  WHERE p.id = v_uid;

  IF v_profile_org IS NOT NULL AND v_profile_org <> v_kit.org_id THEN
    RAISE EXCEPTION 'This account belongs to a different workspace';
  END IF;
  IF v_kit.recipient_email IS NOT NULL
     AND v_profile_email IS NOT NULL
     AND lower(v_kit.recipient_email) <> v_profile_email THEN
    RAISE EXCEPTION 'This box pass is assigned to a different email address';
  END IF;

  UPDATE public.profiles AS p
  SET org_id = v_kit.org_id,
      status = 'active',
      role = 'panelist'
  WHERE p.id = v_uid;

  UPDATE public.panelist_kits AS k
  SET claimed_by = v_uid,
      claimed_at = COALESCE(k.claimed_at, now()),
      status = CASE WHEN k.status IN ('generated', 'printed', 'packed', 'shipped') THEN 'claimed' ELSE k.status END,
      updated_at = now()
  WHERE k.id = v_kit.id;

  UPDATE public.products AS p
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

  RETURN QUERY
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
    k.issue_status,
    k.claimed_by = v_uid AS claimed_by_current_user
  FROM public.panelist_kits AS k
  JOIN public.products AS p ON p.id = k.product_id
  WHERE k.id = v_kit.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_panelist_kit(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_panelist_kit(text, text) TO authenticated;

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

  SELECT k.* INTO v_source
  FROM public.panelist_kits AS k
  WHERE k.id = target_kit_id
    AND k.org_id = public.current_org_id();

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Box pass not found';
  END IF;

  PERFORM public.void_panelist_kit(target_kit_id, COALESCE(NULLIF(p_reason, ''), 'Replacement issued'));

  SELECT count(*) INTO v_existing
  FROM public.panelist_kits AS k
  WHERE k.org_id = v_source.org_id
    AND k.product_id = v_source.product_id;

  v_token := regexp_replace(
    replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
    '=+$',
    ''
  );
  LOOP
    v_manual_code := public.generate_panelist_kit_manual_code();
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.panelist_kits AS existing_kit
      WHERE existing_kit.manual_code = v_manual_code
    );
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

  PERFORM public.record_panelist_kit_event(
    v_inserted.id,
    'replacement_created',
    jsonb_build_object('replacement_for', v_source.id, 'reason', p_reason)
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
END;
$$;

REVOKE ALL ON FUNCTION public.create_replacement_panelist_kit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_replacement_panelist_kit(uuid, text) TO authenticated;
