-- Fielding operations for at-home panelist kits: manual fallback codes,
-- fulfillment tracking, issue reporting, replacement kits, reminders, and event
-- history. Additive to the initial QR invite migrations.

ALTER TABLE public.panelist_kits
  ADD COLUMN IF NOT EXISTS manual_code text,
  ADD COLUMN IF NOT EXISTS printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS packed_at timestamptz,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz,
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS issue_type text,
  ADD COLUMN IF NOT EXISTS issue_note text,
  ADD COLUMN IF NOT EXISTS issue_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS issue_reported_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text,
  ADD COLUMN IF NOT EXISTS replacement_for_kit_id uuid REFERENCES public.panelist_kits(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS panelist_kits_manual_code_key
  ON public.panelist_kits(manual_code)
  WHERE manual_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_panelist_kits_issue_status
  ON public.panelist_kits(org_id, issue_status)
  WHERE issue_status <> 'none';

ALTER TABLE public.panelist_kits
  DROP CONSTRAINT IF EXISTS panelist_kits_status_check;
ALTER TABLE public.panelist_kits
  ADD CONSTRAINT panelist_kits_status_check
  CHECK (status IN ('generated', 'printed', 'packed', 'shipped', 'claimed', 'started', 'submitted', 'expired', 'void'));

ALTER TABLE public.panelist_kits
  DROP CONSTRAINT IF EXISTS panelist_kits_issue_status_check;
ALTER TABLE public.panelist_kits
  ADD CONSTRAINT panelist_kits_issue_status_check
  CHECK (issue_status IN ('none', 'open', 'reviewed', 'resolved'));

CREATE TABLE IF NOT EXISTS public.panelist_kit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  kit_id uuid NOT NULL REFERENCES public.panelist_kits(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_panelist_kit_events_kit
  ON public.panelist_kit_events(kit_id, created_at DESC);

ALTER TABLE public.panelist_kit_events ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_set_org_id ON public.panelist_kit_events;
CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.panelist_kit_events
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

DROP POLICY IF EXISTS panelist_kit_events_admin_select ON public.panelist_kit_events;
CREATE POLICY panelist_kit_events_admin_select ON public.panelist_kit_events
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());

DROP POLICY IF EXISTS panelist_kit_events_panelist_select ON public.panelist_kit_events;
CREATE POLICY panelist_kit_events_panelist_select ON public.panelist_kit_events
  FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND EXISTS (
      SELECT 1 FROM public.panelist_kits k
      WHERE k.id = panelist_kit_events.kit_id
        AND k.claimed_by = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.generate_panelist_kit_manual_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $$
  SELECT 'NFI-' || upper(substr(encode(extensions.gen_random_bytes(5), 'hex'), 1, 8))
$$;

REVOKE ALL ON FUNCTION public.generate_panelist_kit_manual_code() FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.record_panelist_kit_event(
  target_kit_id uuid,
  p_event_type text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT org_id INTO v_org FROM public.panelist_kits WHERE id = target_kit_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Kit not found';
  END IF;

  INSERT INTO public.panelist_kit_events (org_id, kit_id, event_type, actor_id, metadata)
  VALUES (v_org, target_kit_id, p_event_type, auth.uid(), COALESCE(p_metadata, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.record_panelist_kit_event(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_panelist_kit_event(uuid, text, jsonb) TO authenticated;

UPDATE public.panelist_kits k
SET manual_code = public.generate_panelist_kit_manual_code()
WHERE manual_code IS NULL;

DROP FUNCTION IF EXISTS public.generate_panelist_kits(uuid, integer, timestamptz, date, text);
DROP FUNCTION IF EXISTS public.generate_panelist_kits(uuid, integer, timestamptz, date, text, jsonb);
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
  manual_code text,
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
  v_manual_code text;
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
    LOOP
      v_manual_code := public.generate_panelist_kit_manual_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.panelist_kits WHERE manual_code = v_manual_code);
    END LOOP;
    v_sample_code := COALESCE(v_product.blind_code, 'KIT-' || lpad((v_existing + v_i)::text, 3, '0'));
    v_recipient := CASE WHEN v_i <= v_recipient_count THEN p_recipients -> (v_i - 1) ELSE NULL END;
    v_recipient_name := NULLIF(trim(COALESCE(v_recipient->>'name', '')), '');
    v_recipient_email := lower(NULLIF(trim(COALESCE(v_recipient->>'email', '')), ''));

    INSERT INTO public.panelist_kits (
      org_id, product_id, kit_code, manual_code, sample_code, token_hash,
      expires_at, response_deadline, handling_instructions,
      recipient_name, recipient_email, created_by
    )
    VALUES (
      v_org,
      target_product_id,
      'KIT-' || lpad((v_existing + v_i)::text, 3, '0'),
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

    PERFORM public.record_panelist_kit_event(v_inserted.id, 'generated', jsonb_build_object('kit_code', v_inserted.kit_code));

    id := v_inserted.id;
    token := v_token;
    kit_code := v_inserted.kit_code;
    manual_code := v_inserted.manual_code;
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
  manual_code text,
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
    COALESCE(k.submitted_at, r.submitted_at) AS submitted_at,
    COALESCE(ev.reminder_count, 0) AS reminder_count,
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

CREATE OR REPLACE FUNCTION public.get_panelist_kit_by_manual_code(p_manual_code text)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  product_id uuid,
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

DROP FUNCTION IF EXISTS public.claim_panelist_kit(text);
CREATE OR REPLACE FUNCTION public.claim_panelist_kit(p_token text DEFAULT NULL, p_manual_code text DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  org_id uuid,
  product_id uuid,
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
    RAISE EXCEPTION 'You must be signed in to claim this kit';
  END IF;

  SELECT * INTO v_kit
  FROM public.panelist_kits
  WHERE (p_token IS NOT NULL AND token_hash = public.panelist_kit_token_hash(p_token))
     OR (p_manual_code IS NOT NULL AND upper(manual_code) = upper(trim(p_manual_code)))
  FOR UPDATE;

  IF v_kit.id IS NULL THEN
    RAISE EXCEPTION 'This kit link or code is invalid';
  END IF;
  IF v_kit.expires_at IS NOT NULL AND v_kit.expires_at < now() THEN
    UPDATE public.panelist_kits
    SET status = 'expired', updated_at = now()
    WHERE id = v_kit.id;
    PERFORM public.record_panelist_kit_event(v_kit.id, 'expired', '{}'::jsonb);
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
      status = CASE WHEN status IN ('generated', 'printed', 'packed', 'shipped') THEN 'claimed' ELSE status END,
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

  PERFORM public.record_panelist_kit_event(v_kit.id, 'claimed', jsonb_build_object('user_id', v_uid));

  IF p_token IS NOT NULL THEN
    RETURN QUERY SELECT * FROM public.get_panelist_kit_by_token(p_token);
  ELSE
    RETURN QUERY SELECT * FROM public.get_panelist_kit_by_manual_code(p_manual_code);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_panelist_kit(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_panelist_kit(text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.mark_panelist_kit_started(text);
CREATE OR REPLACE FUNCTION public.mark_panelist_kit_started(p_token text DEFAULT NULL, p_manual_code text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kit_id uuid;
BEGIN
  UPDATE public.panelist_kits
  SET status = CASE WHEN status IN ('generated', 'printed', 'packed', 'shipped', 'claimed') THEN 'started' ELSE status END,
      started_at = COALESCE(started_at, now()),
      updated_at = now()
  WHERE (
      (p_token IS NOT NULL AND token_hash = public.panelist_kit_token_hash(p_token))
      OR (p_manual_code IS NOT NULL AND upper(manual_code) = upper(trim(p_manual_code)))
    )
    AND claimed_by = auth.uid()
    AND status NOT IN ('void', 'submitted')
  RETURNING id INTO v_kit_id;

  IF v_kit_id IS NOT NULL THEN
    PERFORM public.record_panelist_kit_event(v_kit_id, 'started', '{}'::jsonb);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_panelist_kit_started(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_panelist_kit_started(text, text) TO authenticated;

DROP FUNCTION IF EXISTS public.mark_panelist_kit_submitted(text);
CREATE OR REPLACE FUNCTION public.mark_panelist_kit_submitted(p_token text DEFAULT NULL, p_manual_code text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kit_id uuid;
BEGIN
  UPDATE public.panelist_kits
  SET status = 'submitted',
      submitted_at = COALESCE(submitted_at, now()),
      updated_at = now()
  WHERE (
      (p_token IS NOT NULL AND token_hash = public.panelist_kit_token_hash(p_token))
      OR (p_manual_code IS NOT NULL AND upper(manual_code) = upper(trim(p_manual_code)))
    )
    AND claimed_by = auth.uid()
    AND status <> 'void'
  RETURNING id INTO v_kit_id;

  IF v_kit_id IS NOT NULL THEN
    PERFORM public.record_panelist_kit_event(v_kit_id, 'submitted', '{}'::jsonb);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_panelist_kit_submitted(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_panelist_kit_submitted(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_panelist_kit_fulfillment(
  target_kit_id uuid,
  p_status text,
  p_tracking_number text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update kit fulfillment';
  END IF;

  UPDATE public.panelist_kits
  SET status = CASE
        WHEN p_status IN ('printed', 'packed', 'shipped') THEN p_status
        ELSE status
      END,
      printed_at = CASE WHEN p_status = 'printed' THEN COALESCE(printed_at, now()) ELSE printed_at END,
      packed_at = CASE WHEN p_status = 'packed' THEN COALESCE(packed_at, now()) ELSE packed_at END,
      shipped_at = CASE WHEN p_status = 'shipped' THEN COALESCE(shipped_at, now()) ELSE shipped_at END,
      tracking_number = COALESCE(NULLIF(trim(p_tracking_number), ''), tracking_number),
      updated_at = now()
  WHERE id = target_kit_id
    AND org_id = public.current_org_id();

  PERFORM public.record_panelist_kit_event(target_kit_id, p_status, jsonb_build_object('tracking_number', p_tracking_number));
END;
$$;

REVOKE ALL ON FUNCTION public.update_panelist_kit_fulfillment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_panelist_kit_fulfillment(uuid, text, text) TO authenticated;

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
BEGIN
  UPDATE public.panelist_kits
  SET issue_type = p_issue_type,
      issue_note = NULLIF(trim(p_issue_note), ''),
      issue_status = 'open',
      issue_reported_at = now(),
      updated_at = now()
  WHERE (p_token IS NOT NULL AND token_hash = public.panelist_kit_token_hash(p_token))
     OR (p_manual_code IS NOT NULL AND upper(manual_code) = upper(trim(p_manual_code)))
  RETURNING id INTO v_kit_id;

  IF v_kit_id IS NULL THEN
    RAISE EXCEPTION 'Kit not found';
  END IF;

  PERFORM public.record_panelist_kit_event(
    v_kit_id,
    'issue_reported',
    jsonb_build_object('issue_type', p_issue_type, 'issue_note', p_issue_note)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.report_panelist_kit_issue(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_panelist_kit_issue(text, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_panelist_kit_reminder(target_kit_id uuid, p_reason text DEFAULT 'manual')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can record reminders';
  END IF;
  PERFORM public.record_panelist_kit_event(target_kit_id, 'reminder_sent', jsonb_build_object('reason', p_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.record_panelist_kit_reminder(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_panelist_kit_reminder(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.void_panelist_kit(target_kit_id uuid, p_reason text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can void kits';
  END IF;
  UPDATE public.panelist_kits
  SET status = 'void',
      voided_at = now(),
      void_reason = NULLIF(trim(p_reason), ''),
      updated_at = now()
  WHERE id = target_kit_id
    AND org_id = public.current_org_id();
  PERFORM public.record_panelist_kit_event(target_kit_id, 'voided', jsonb_build_object('reason', p_reason));
END;
$$;

REVOKE ALL ON FUNCTION public.void_panelist_kit(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.void_panelist_kit(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_replacement_panelist_kit(target_kit_id uuid, p_reason text DEFAULT '')
RETURNS TABLE (
  id uuid,
  token text,
  kit_code text,
  manual_code text,
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
  v_source public.panelist_kits%ROWTYPE;
  v_existing integer;
  v_token text;
  v_manual_code text;
  v_inserted public.panelist_kits%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create replacement kits';
  END IF;

  SELECT * INTO v_source
  FROM public.panelist_kits
  WHERE id = target_kit_id
    AND org_id = public.current_org_id();

  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'Kit not found';
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
    org_id, product_id, kit_code, manual_code, sample_code, token_hash,
    expires_at, response_deadline, handling_instructions, recipient_name,
    recipient_email, replacement_for_kit_id, created_by
  )
  VALUES (
    v_source.org_id,
    v_source.product_id,
    'KIT-' || lpad((v_existing + 1)::text, 3, '0'),
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

CREATE OR REPLACE FUNCTION public.fetch_panelist_kit_events(target_kit_id uuid)
RETURNS TABLE (
  id uuid,
  kit_id uuid,
  event_type text,
  actor_id uuid,
  actor_name text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    e.id,
    e.kit_id,
    e.event_type,
    e.actor_id,
    p.name AS actor_name,
    e.metadata,
    e.created_at
  FROM public.panelist_kit_events e
  LEFT JOIN public.profiles p ON p.id = e.actor_id
  JOIN public.panelist_kits k ON k.id = e.kit_id
  WHERE e.kit_id = target_kit_id
    AND e.org_id = public.current_org_id()
    AND (
      public.is_admin()
      OR k.claimed_by = auth.uid()
    )
  ORDER BY e.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.fetch_panelist_kit_events(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fetch_panelist_kit_events(uuid) TO authenticated;
