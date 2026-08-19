-- Make box deadlines enforceable, keep multi-task passes open until every task
-- is complete, and prevent terminal/unsafe passes from granting product access.
-- All helper functions live outside the exposed API schema, so this migration
-- does not change the generated public Database type contract.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE OR REPLACE FUNCTION private.set_panelist_kit_expiry_from_deadline()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.expires_at IS NULL AND NEW.response_deadline IS NOT NULL THEN
    -- "Complete by" includes the whole displayed date in the NFI timezone.
    NEW.expires_at := ((NEW.response_deadline + 1)::timestamp AT TIME ZONE 'Europe/London');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_panelist_kit_expiry_from_deadline ON public.panelist_kits;
CREATE TRIGGER set_panelist_kit_expiry_from_deadline
  BEFORE INSERT OR UPDATE OF response_deadline, expires_at ON public.panelist_kits
  FOR EACH ROW EXECUTE FUNCTION private.set_panelist_kit_expiry_from_deadline();

UPDATE public.panelist_kits
SET expires_at = ((response_deadline + 1)::timestamp AT TIME ZONE 'Europe/London')
WHERE expires_at IS NULL
  AND response_deadline IS NOT NULL;

CREATE OR REPLACE FUNCTION private.panelist_product_access_is_usable(
  target_panelist_id uuid,
  target_product_id uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1
      FROM public.panelist_kits AS associated
      WHERE associated.claimed_by = target_panelist_id
        AND target_product_id = ANY(associated.assigned_product_ids)
    )
    OR EXISTS (
      SELECT 1
      FROM public.panelist_kits AS usable
      WHERE usable.claimed_by = target_panelist_id
        AND target_product_id = ANY(usable.assigned_product_ids)
        AND usable.status NOT IN ('void', 'expired', 'submitted')
        AND (usable.expires_at IS NULL OR usable.expires_at >= now())
        AND usable.issue_status <> 'open'
    );
$$;

REVOKE ALL ON FUNCTION private.panelist_product_access_is_usable(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.panelist_product_access_is_usable(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.enforce_panelist_kit_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('claimed', 'started', 'submitted')
     AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status IN ('void', 'expired', 'submitted') THEN
      RAISE EXCEPTION 'This box pass is no longer available';
    END IF;
    IF NEW.expires_at IS NOT NULL AND NEW.expires_at < now() THEN
      RAISE EXCEPTION 'This box pass has expired';
    END IF;
    IF NEW.issue_status = 'open' THEN
      RAISE EXCEPTION 'This box pass is paused while the reported issue is reviewed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_panelist_kit_transition ON public.panelist_kits;
CREATE TRIGGER enforce_panelist_kit_transition
  BEFORE UPDATE OF status ON public.panelist_kits
  FOR EACH ROW EXECUTE FUNCTION private.enforce_panelist_kit_transition();

CREATE OR REPLACE FUNCTION public.mark_panelist_kit_started(
  p_token text DEFAULT NULL,
  p_manual_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kit public.panelist_kits%ROWTYPE;
BEGIN
  SELECT k.* INTO v_kit
  FROM public.panelist_kits AS k
  WHERE (
      (p_token IS NOT NULL AND k.token_hash = public.panelist_kit_token_hash(p_token))
      OR (p_manual_code IS NOT NULL AND upper(k.manual_code) = upper(trim(p_manual_code)))
    )
    AND k.claimed_by = auth.uid()
  FOR UPDATE OF k;

  IF v_kit.id IS NULL THEN
    RAISE EXCEPTION 'This box pass is not assigned to your account';
  END IF;
  IF v_kit.status IN ('void', 'expired', 'submitted')
     OR (v_kit.expires_at IS NOT NULL AND v_kit.expires_at < now()) THEN
    RAISE EXCEPTION 'This box pass is no longer available';
  END IF;
  IF v_kit.issue_status = 'open' THEN
    RAISE EXCEPTION 'This box pass is paused while the reported issue is reviewed';
  END IF;

  UPDATE public.panelist_kits AS k
  SET status = 'started',
      started_at = COALESCE(k.started_at, now()),
      updated_at = now()
  WHERE k.id = v_kit.id;

  PERFORM public.record_panelist_kit_event(v_kit.id, 'started', '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_panelist_kit_started(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_panelist_kit_started(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_panelist_kit_submitted(
  p_token text DEFAULT NULL,
  p_manual_code text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_kit public.panelist_kits%ROWTYPE;
  v_completed_product_count integer;
  v_assigned_product_count integer;
  v_all_tasks_complete boolean;
BEGIN
  SELECT k.* INTO v_kit
  FROM public.panelist_kits AS k
  WHERE (
      (p_token IS NOT NULL AND k.token_hash = public.panelist_kit_token_hash(p_token))
      OR (p_manual_code IS NOT NULL AND upper(k.manual_code) = upper(trim(p_manual_code)))
    )
    AND k.claimed_by = auth.uid()
  FOR UPDATE OF k;

  IF v_kit.id IS NULL THEN
    RAISE EXCEPTION 'This box pass is not assigned to your account';
  END IF;
  IF v_kit.status IN ('void', 'expired')
     OR (v_kit.expires_at IS NOT NULL AND v_kit.expires_at < now()) THEN
    RAISE EXCEPTION 'This box pass is no longer available';
  END IF;
  IF v_kit.issue_status = 'open' THEN
    RAISE EXCEPTION 'This box pass is paused while the reported issue is reviewed';
  END IF;

  SELECT count(DISTINCT r.product_id)::integer
  INTO v_completed_product_count
  FROM public.responses AS r
  WHERE r.user_id = auth.uid()
    AND r.product_id = ANY(v_kit.assigned_product_ids);

  v_assigned_product_count := cardinality(v_kit.assigned_product_ids);
  v_all_tasks_complete := v_assigned_product_count > 0
    AND v_completed_product_count >= v_assigned_product_count;

  UPDATE public.panelist_kits AS k
  SET status = CASE WHEN v_all_tasks_complete THEN 'submitted' ELSE 'started' END,
      started_at = COALESCE(k.started_at, now()),
      submitted_at = CASE WHEN v_all_tasks_complete THEN COALESCE(k.submitted_at, now()) ELSE NULL END,
      updated_at = now()
  WHERE k.id = v_kit.id;

  PERFORM public.record_panelist_kit_event(
    v_kit.id,
    CASE WHEN v_all_tasks_complete THEN 'submitted' ELSE 'task_submitted' END,
    jsonb_build_object(
      'completed_product_count', v_completed_product_count,
      'assigned_product_count', v_assigned_product_count
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mark_panelist_kit_submitted(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_panelist_kit_submitted(text, text) TO authenticated;

DROP POLICY IF EXISTS products_select_authenticated ON public.products;
CREATE POLICY products_select_authenticated ON public.products
  FOR SELECT TO authenticated
  USING (
    public.is_active_user()
    AND (
      public.is_admin()
      OR (
        status = 'active'
        AND assigned_panelist_ids @> ARRAY[auth.uid()::text]
        AND public.panelist_is_eligible_for_sample(auth.uid(), id, NULL)
        AND private.panelist_product_access_is_usable(auth.uid(), id)
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
      FROM public.products AS p
      WHERE p.id = product_id
        AND p.status = 'active'
        AND p.assigned_panelist_ids @> ARRAY[auth.uid()::text]
        AND public.panelist_is_eligible_for_sample(auth.uid(), p.id, NULL)
        AND private.panelist_product_access_is_usable(auth.uid(), p.id)
    )
  );
