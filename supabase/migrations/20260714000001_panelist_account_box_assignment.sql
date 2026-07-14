-- Move panelist box fulfillment to an account-first workflow. Administrators
-- invite an email, panelists complete their shipping profile, and box passes
-- are generated for selected profile IDs. The box retains a shipping snapshot
-- so a later profile edit cannot silently change an already-prepared shipment.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz;

CREATE OR REPLACE FUNCTION public.complete_panelist_profile(
  p_name text,
  p_phone text,
  p_address_line_1 text,
  p_address_line_2 text DEFAULT '',
  p_city text DEFAULT '',
  p_region text DEFAULT '',
  p_postal_code text DEFAULT '',
  p_country text DEFAULT '',
  p_consent_version text DEFAULT '',
  p_consent_user_agent text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to complete your profile';
  END IF;
  IF length(trim(COALESCE(p_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Enter your full name';
  END IF;
  IF length(trim(COALESCE(p_phone, ''))) < 7 THEN
    RAISE EXCEPTION 'Enter a valid phone number';
  END IF;
  IF length(trim(COALESCE(p_address_line_1, ''))) < 3
     OR length(trim(COALESCE(p_city, ''))) < 2
     OR length(trim(COALESCE(p_postal_code, ''))) < 2
     OR length(trim(COALESCE(p_country, ''))) < 2 THEN
    RAISE EXCEPTION 'Complete the required shipping address fields';
  END IF;
  IF length(trim(COALESCE(p_consent_version, ''))) = 0 THEN
    RAISE EXCEPTION 'Panelist consent is required';
  END IF;

  UPDATE public.profiles AS p
  SET name = trim(p_name),
      phone = trim(p_phone),
      address_line_1 = trim(p_address_line_1),
      address_line_2 = NULLIF(trim(COALESCE(p_address_line_2, '')), ''),
      city = trim(p_city),
      region = NULLIF(trim(COALESCE(p_region, '')), ''),
      postal_code = trim(p_postal_code),
      country = trim(p_country),
      consent_accepted_at = now(),
      consent_version = trim(p_consent_version),
      consent_user_agent = NULLIF(trim(COALESCE(p_consent_user_agent, '')), ''),
      profile_completed_at = now()
  WHERE p.id = v_user_id
    AND p.role = 'panelist'
    AND p.status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'An active panelist account was not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_panelist_profile(text, text, text, text, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_panelist_profile(text, text, text, text, text, text, text, text, text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb, uuid[]);
CREATE OR REPLACE FUNCTION public.generate_panelist_kits(
  target_product_id uuid,
  kit_count integer,
  p_expires_at timestamptz DEFAULT NULL,
  p_response_deadline date DEFAULT NULL,
  p_handling_instructions text DEFAULT '',
  p_recipients jsonb DEFAULT '[]'::jsonb,
  p_assigned_product_ids uuid[] DEFAULT NULL,
  p_panelist_ids uuid[] DEFAULT NULL
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
  recipient_address text,
  claimed_by uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid := public.current_org_id();
  v_product record;
  v_panelist record;
  v_existing integer := 0;
  v_token text;
  v_manual_code text;
  v_sample_code text;
  v_inserted public.panelist_kits%ROWTYPE;
  v_recipient jsonb;
  v_recipient_count integer := COALESCE(jsonb_array_length(p_recipients), 0);
  v_panelist_count integer := COALESCE(cardinality(p_panelist_ids), 0);
  v_recipient_name text;
  v_recipient_email text;
  v_recipient_address text;
  v_panelist_id uuid;
  v_assigned_products uuid[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can generate panelist box passes';
  END IF;
  IF kit_count < 1 OR kit_count > 250 THEN
    RAISE EXCEPTION 'kit_count must be between 1 and 250';
  END IF;
  IF v_panelist_count > 0 AND v_panelist_count <> kit_count THEN
    RAISE EXCEPTION 'Create exactly one box for each selected panelist';
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
    v_panelist_id := CASE WHEN v_i <= v_panelist_count THEN p_panelist_ids[v_i] ELSE NULL END;
    v_recipient := CASE WHEN v_i <= v_recipient_count THEN p_recipients -> (v_i - 1) ELSE NULL END;

    IF v_panelist_id IS NOT NULL THEN
      SELECT
        p.id,
        p.name,
        p.email,
        concat_ws(E'\n',
          p.address_line_1,
          NULLIF(p.address_line_2, ''),
          concat_ws(', ', NULLIF(p.city, ''), NULLIF(p.region, '')),
          p.postal_code,
          p.country
        ) AS shipping_address
      INTO v_panelist
      FROM public.profiles AS p
      WHERE p.id = v_panelist_id
        AND p.org_id = v_org
        AND p.role = 'panelist'
        AND p.status = 'active'
        AND p.profile_completed_at IS NOT NULL;

      IF v_panelist.id IS NULL THEN
        RAISE EXCEPTION 'Selected panelist % does not have a complete active profile', v_panelist_id;
      END IF;

      v_recipient_name := v_panelist.name;
      v_recipient_email := lower(v_panelist.email);
      v_recipient_address := v_panelist.shipping_address;
    ELSE
      v_recipient_name := NULLIF(trim(COALESCE(v_recipient->>'name', '')), '');
      v_recipient_email := lower(NULLIF(trim(COALESCE(v_recipient->>'email', '')), ''));
      v_recipient_address := NULLIF(trim(COALESCE(v_recipient->>'address', '')), '');
    END IF;

    v_token := regexp_replace(
      replace(replace(encode(extensions.gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
      '=+$',
      ''
    );
    LOOP
      v_manual_code := public.generate_panelist_kit_manual_code();
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.panelist_kits AS existing_kit
        WHERE existing_kit.manual_code = v_manual_code
      );
    END LOOP;
    v_sample_code := COALESCE(v_product.blind_code, 'BOX-' || lpad((v_existing + v_i)::text, 3, '0'));

    INSERT INTO public.panelist_kits (
      org_id, product_id, assigned_product_ids, kit_code, manual_code, sample_code, token_hash,
      expires_at, response_deadline, handling_instructions,
      recipient_name, recipient_email, recipient_address, claimed_by, claimed_at, created_by
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
      v_recipient_address,
      v_panelist_id,
      CASE WHEN v_panelist_id IS NOT NULL THEN now() ELSE NULL END,
      auth.uid()
    )
    RETURNING * INTO v_inserted;

    IF v_panelist_id IS NOT NULL THEN
      UPDATE public.products AS p
      SET assigned_panelist_ids = CASE
        WHEN COALESCE(p.assigned_panelist_ids, ARRAY[]::text[]) @> ARRAY[v_panelist_id::text]
          THEN p.assigned_panelist_ids
        ELSE array_append(COALESCE(p.assigned_panelist_ids, ARRAY[]::text[]), v_panelist_id::text)
      END
      WHERE p.id = ANY(v_assigned_products)
        AND p.org_id = v_org;
    END IF;

    PERFORM public.record_panelist_kit_event(
      v_inserted.id,
      'generated',
      jsonb_build_object(
        'kit_code', v_inserted.kit_code,
        'assigned_product_count', cardinality(v_assigned_products),
        'assigned_panelist_id', v_panelist_id
      )
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
    recipient_address := v_inserted.recipient_address;
    claimed_by := v_inserted.claimed_by;
    created_at := v_inserted.created_at;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb, uuid[], uuid[]) TO authenticated;
