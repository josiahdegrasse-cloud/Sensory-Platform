-- PL/pgSQL integer FOR loops declare their own counter. The earlier repair
-- retained an explicit v_i declaration, which is harmless at runtime but
-- leaves the live schema with a shadowed-variable lint warning.

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
