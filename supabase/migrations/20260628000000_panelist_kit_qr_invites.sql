-- At-home tasting kit QR invites.
-- Adds one tokenized record per physical kit so shipped samples can be claimed
-- by panelists without opening a generic public questionnaire link.

CREATE TABLE IF NOT EXISTS public.panelist_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  kit_code text NOT NULL,
  sample_code text,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'claimed', 'started', 'submitted', 'expired', 'void')),
  handling_instructions text NOT NULL DEFAULT '',
  response_deadline date,
  expires_at timestamptz,
  claimed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  started_at timestamptz,
  submitted_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, product_id, kit_code)
);

CREATE INDEX IF NOT EXISTS idx_panelist_kits_org_product
  ON public.panelist_kits(org_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_panelist_kits_claimed_by
  ON public.panelist_kits(claimed_by)
  WHERE claimed_by IS NOT NULL;

ALTER TABLE public.panelist_kits ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_set_org_id ON public.panelist_kits;
CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.panelist_kits
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

DROP POLICY IF EXISTS panelist_kits_admin_select ON public.panelist_kits;
CREATE POLICY panelist_kits_admin_select ON public.panelist_kits
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());

DROP POLICY IF EXISTS panelist_kits_claimed_select ON public.panelist_kits;
CREATE POLICY panelist_kits_claimed_select ON public.panelist_kits
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND claimed_by = auth.uid());

CREATE OR REPLACE FUNCTION public.panelist_kit_token_hash(p_token text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
IMMUTABLE
SET search_path = ''
AS $$
  SELECT encode(extensions.digest(p_token, 'sha256'), 'hex')
$$;

REVOKE ALL ON FUNCTION public.panelist_kit_token_hash(text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.generate_panelist_kits(
  target_product_id uuid,
  kit_count integer,
  p_expires_at timestamptz DEFAULT NULL,
  p_response_deadline date DEFAULT NULL,
  p_handling_instructions text DEFAULT ''
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

    INSERT INTO public.panelist_kits (
      org_id,
      product_id,
      kit_code,
      sample_code,
      token_hash,
      expires_at,
      response_deadline,
      handling_instructions,
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
    created_at := v_inserted.created_at;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_panelist_kits(uuid, integer, timestamptz, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_panelist_kits(uuid, integer, timestamptz, date, text) TO authenticated;

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

CREATE OR REPLACE FUNCTION public.get_panelist_kit_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  product_id uuid,
  product_name text,
  product_category text,
  is_multi_sample boolean,
  sample_code text,
  kit_code text,
  calculated_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
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
    p.name AS product_name,
    p.category AS product_category,
    COALESCE(p.is_multi_sample, false) AS is_multi_sample,
    k.sample_code,
    k.kit_code,
    CASE
      WHEN k.submitted_at IS NOT NULL THEN 'submitted'
      WHEN k.expires_at IS NOT NULL AND k.expires_at < now() THEN 'expired'
      ELSE k.status
    END AS calculated_status,
    k.expires_at,
    k.response_deadline,
    k.handling_instructions,
    k.claimed_by
  FROM public.panelist_kits k
  JOIN public.products p ON p.id = k.product_id
  JOIN public.organizations o ON o.id = k.org_id AND o.status = 'active'
  WHERE k.token_hash = public.panelist_kit_token_hash(p_token)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_panelist_kit_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_panelist_kit_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_panelist_kit(p_token text)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  product_id uuid,
  product_name text,
  product_category text,
  is_multi_sample boolean,
  sample_code text,
  kit_code text,
  calculated_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
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
    RAISE EXCEPTION 'You must be signed in to claim this kit';
  END IF;

  SELECT * INTO v_kit
  FROM public.panelist_kits
  WHERE token_hash = public.panelist_kit_token_hash(p_token)
  FOR UPDATE;

  IF v_kit.id IS NULL THEN
    RAISE EXCEPTION 'This kit link is invalid';
  END IF;
  IF v_kit.expires_at IS NOT NULL AND v_kit.expires_at < now() THEN
    UPDATE public.panelist_kits
    SET status = 'expired', updated_at = now()
    WHERE id = v_kit.id;
    RAISE EXCEPTION 'This kit link has expired';
  END IF;
  IF v_kit.status IN ('void', 'submitted') THEN
    RAISE EXCEPTION 'This kit is no longer available';
  END IF;
  IF v_kit.claimed_by IS NOT NULL AND v_kit.claimed_by <> v_uid THEN
    RAISE EXCEPTION 'This kit has already been claimed';
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
      status = CASE WHEN status = 'generated' THEN 'claimed' ELSE status END,
      updated_at = now()
  WHERE id = v_kit.id;

  UPDATE public.products p
  SET assigned_panelist_ids = CASE
    WHEN p.assigned_panelist_ids @> ARRAY[v_uid::text] THEN p.assigned_panelist_ids
    ELSE array_append(COALESCE(p.assigned_panelist_ids, ARRAY[]::text[]), v_uid::text)
  END
  WHERE p.id = v_kit.product_id
    AND p.org_id = v_kit.org_id
    AND p.status = 'active';

  RETURN QUERY
  SELECT * FROM public.get_panelist_kit_by_token(p_token);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_panelist_kit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_panelist_kit(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_panelist_kit_started(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.panelist_kits
  SET status = CASE WHEN status IN ('generated', 'claimed') THEN 'started' ELSE status END,
      started_at = COALESCE(started_at, now()),
      updated_at = now()
  WHERE token_hash = public.panelist_kit_token_hash(p_token)
    AND claimed_by = auth.uid()
    AND status NOT IN ('void', 'submitted');
END;
$$;

REVOKE ALL ON FUNCTION public.mark_panelist_kit_started(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_panelist_kit_started(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_panelist_kit_submitted(p_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.panelist_kits
  SET status = 'submitted',
      submitted_at = COALESCE(submitted_at, now()),
      updated_at = now()
  WHERE token_hash = public.panelist_kit_token_hash(p_token)
    AND claimed_by = auth.uid()
    AND status <> 'void';
END;
$$;

REVOKE ALL ON FUNCTION public.mark_panelist_kit_submitted(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_panelist_kit_submitted(text) TO authenticated;
