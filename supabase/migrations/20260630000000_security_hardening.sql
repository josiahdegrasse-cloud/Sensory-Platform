-- Security hardening for at-home panelist box passes and profile self-updates.
-- This migration intentionally replaces the latest RPC definitions from
-- 20260628000003_panelist_box_task_invites.sql with narrower public responses.

CREATE OR REPLACE FUNCTION public.generate_panelist_kit_manual_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $$
  SELECT 'NFI-' ||
    substr(upper(encode(extensions.gen_random_bytes(8), 'hex')), 1, 8) ||
    '-' ||
    substr(upper(encode(extensions.gen_random_bytes(8), 'hex')), 9, 8)
$$;

REVOKE ALL ON FUNCTION public.generate_panelist_kit_manual_code() FROM PUBLIC;

DROP FUNCTION IF EXISTS public.get_panelist_kit_by_token(text);
CREATE OR REPLACE FUNCTION public.get_panelist_kit_by_token(p_token text)
RETURNS TABLE (
  org_id uuid,
  assigned_product_count integer,
  product_name text,
  product_category text,
  is_multi_sample boolean,
  sample_code text,
  kit_code text,
  calculated_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  issue_type text,
  issue_status text,
  claimed_by_current_user boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    k.org_id,
    cardinality(k.assigned_product_ids) AS assigned_product_count,
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
    k.issue_type,
    k.issue_status,
    k.claimed_by IS NOT NULL AND k.claimed_by = auth.uid() AS claimed_by_current_user
  FROM public.panelist_kits k
  JOIN public.products p ON p.id = k.product_id
  JOIN public.organizations o ON o.id = k.org_id AND o.status = 'active'
  WHERE p_token IS NOT NULL
    AND length(trim(p_token)) >= 24
    AND k.token_hash = public.panelist_kit_token_hash(p_token)
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_panelist_kit_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_panelist_kit_by_token(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_panelist_kit_by_manual_code(text);
CREATE OR REPLACE FUNCTION public.get_panelist_kit_by_manual_code(p_manual_code text)
RETURNS TABLE (
  org_id uuid,
  assigned_product_count integer,
  product_name text,
  product_category text,
  is_multi_sample boolean,
  sample_code text,
  kit_code text,
  calculated_status text,
  expires_at timestamptz,
  response_deadline date,
  handling_instructions text,
  issue_type text,
  issue_status text,
  claimed_by_current_user boolean
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    k.org_id,
    cardinality(k.assigned_product_ids) AS assigned_product_count,
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
    k.issue_type,
    k.issue_status,
    k.claimed_by IS NOT NULL AND k.claimed_by = auth.uid() AS claimed_by_current_user
  FROM public.panelist_kits k
  JOIN public.products p ON p.id = k.product_id
  JOIN public.organizations o ON o.id = k.org_id AND o.status = 'active'
  WHERE p_manual_code IS NOT NULL
    AND upper(k.manual_code) = upper(trim(p_manual_code))
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

  SELECT p.org_id, lower(COALESCE(p.email, u.email))
  INTO v_profile_org, v_profile_email
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
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
      claimed_at = COALESCE(claimed_at, now()),
      status = CASE WHEN status IN ('generated', 'printed', 'packed', 'shipped') THEN 'claimed' ELSE status END,
      updated_at = now()
  WHERE k.id = v_kit.id;

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
  FROM public.panelist_kits k
  JOIN public.products p ON p.id = k.product_id
  WHERE k.id = v_kit.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_panelist_kit(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_panelist_kit(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.report_panelist_kit_issue(
  p_token text DEFAULT NULL,
  p_manual_code text DEFAULT NULL,
  p_issue_type text DEFAULT 'other',
  p_issue_note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kit_id uuid;
  v_issue_type text := lower(trim(COALESCE(p_issue_type, 'other')));
  v_issue_note text := left(trim(COALESCE(p_issue_note, '')), 1000);
BEGIN
  IF v_issue_type NOT IN ('damaged', 'wrong_code', 'allergy', 'cannot_complete', 'signin', 'other') THEN
    v_issue_type := 'other';
  END IF;

  UPDATE public.panelist_kits
  SET issue_type = v_issue_type,
      issue_note = NULLIF(v_issue_note, ''),
      issue_status = 'open',
      issue_reported_at = now(),
      updated_at = now()
  WHERE (
      (p_token IS NOT NULL AND token_hash = public.panelist_kit_token_hash(p_token))
      OR (p_manual_code IS NOT NULL AND upper(manual_code) = upper(trim(p_manual_code)))
    )
    AND status NOT IN ('void', 'submitted')
  RETURNING id INTO v_kit_id;

  IF v_kit_id IS NULL THEN
    RAISE EXCEPTION 'Kit not found';
  END IF;

  PERFORM public.record_panelist_kit_event(
    v_kit_id,
    'issue_reported',
    jsonb_build_object('issue_type', v_issue_type, 'issue_note_length', length(v_issue_note))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_panelist_kit_issue(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_panelist_kit_issue(text, text, text, text) TO anon, authenticated;

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id AND NOT public.is_admin())
  WITH CHECK (
    auth.uid() = id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) = role
    AND (SELECT panelist_id FROM public.profiles WHERE id = auth.uid()) IS NOT DISTINCT FROM panelist_id
    AND (SELECT org_id FROM public.profiles WHERE id = auth.uid()) IS NOT DISTINCT FROM org_id
    AND (SELECT status FROM public.profiles WHERE id = auth.uid()) IS NOT DISTINCT FROM status
    AND (SELECT email FROM public.profiles WHERE id = auth.uid()) IS NOT DISTINCT FROM email
    AND (SELECT training_level FROM public.profiles WHERE id = auth.uid()) IS NOT DISTINCT FROM training_level
  );
