-- Add recipient details to at-home tasting kits so printed QR inserts can be
-- packed for named panelists without manual matching.

ALTER TABLE public.panelist_kits
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS recipient_email text;

CREATE OR REPLACE FUNCTION public.generate_panelist_kits(
  target_product_id uuid,
  kit_count integer,
  p_expires_at timestamptz DEFAULT NULL,
  p_response_deadline date DEFAULT NULL,
  p_handling_instructions text DEFAULT '',
  p_recipients jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (
  id uuid,
  token text,
  kit_code text,
  sample_code text,
  product_id uuid,
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
  v_sample_code text;
  v_inserted public.panelist_kits%ROWTYPE;
  v_recipient jsonb;
  v_recipient_count integer := COALESCE(jsonb_array_length(p_recipients), 0);
  v_recipient_name text;
  v_recipient_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can generate panelist kits';
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
    v_sample_code := COALESCE(v_product.blind_code, 'KIT-' || lpad((v_existing + v_i)::text, 3, '0'));
    v_recipient := CASE WHEN v_i <= v_recipient_count THEN p_recipients -> (v_i - 1) ELSE NULL END;
    v_recipient_name := NULLIF(trim(COALESCE(v_recipient->>'name', '')), '');
    v_recipient_email := lower(NULLIF(trim(COALESCE(v_recipient->>'email', '')), ''));

    INSERT INTO public.panelist_kits (
      org_id,
      product_id,
      kit_code,
      sample_code,
      token_hash,
      expires_at,
      response_deadline,
      handling_instructions,
      recipient_name,
      recipient_email,
      created_by
    )
    VALUES (
      v_org,
      target_product_id,
      'KIT-' || lpad((v_existing + v_i)::text, 3, '0'),
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

    id := v_inserted.id;
    token := v_token;
    kit_code := v_inserted.kit_code;
    sample_code := v_inserted.sample_code;
    product_id := v_inserted.product_id;
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

REVOKE ALL ON FUNCTION public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb) TO authenticated;

DROP FUNCTION IF EXISTS public.list_panelist_kits(uuid);
CREATE OR REPLACE FUNCTION public.list_panelist_kits(target_product_id uuid)
RETURNS TABLE (
  id uuid,
  kit_code text,
  sample_code text,
  product_id uuid,
  product_name text,
  calculated_status text,
  stored_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  recipient_name text,
  recipient_email text,
  claimed_by uuid,
  claimed_panelist_name text,
  claimed_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
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
    k.sample_code,
    k.product_id,
    p.name AS product_name,
    CASE
      WHEN k.submitted_at IS NOT NULL OR r.submitted_at IS NOT NULL THEN 'submitted'
      WHEN k.expires_at IS NOT NULL AND k.expires_at < now() THEN 'expired'
      ELSE k.status
    END AS calculated_status,
    k.status AS stored_status,
    k.expires_at,
    k.response_deadline,
    k.handling_instructions,
    k.recipient_name,
    k.recipient_email,
    k.claimed_by,
    pr.name AS claimed_panelist_name,
    k.claimed_at,
    k.started_at,
    COALESCE(k.submitted_at, r.submitted_at) AS submitted_at,
    k.created_at
  FROM public.panelist_kits k
  JOIN public.products p ON p.id = k.product_id
  LEFT JOIN public.profiles pr ON pr.id = k.claimed_by
  LEFT JOIN LATERAL (
    SELECT max(res.created_at) AS submitted_at
    FROM public.responses res
    WHERE res.product_id = k.product_id
      AND res.user_id = k.claimed_by
  ) r ON true
  WHERE k.product_id = target_product_id
    AND k.org_id = public.current_org_id()
    AND public.is_admin()
  ORDER BY k.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.list_panelist_kits(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_panelist_kits(uuid) TO authenticated;
