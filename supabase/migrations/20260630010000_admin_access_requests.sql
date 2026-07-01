-- Company-domain self signups are admin access requests, not panelists.
-- Existing admins approve or reject the request before the user can enter the
-- admin workspace.

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'panelist', 'pending_admin'));

CREATE TABLE IF NOT EXISTS public.admin_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_email text NOT NULL,
  requester_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text NOT NULL DEFAULT '',
  UNIQUE (requester_id)
);

CREATE INDEX IF NOT EXISTS idx_admin_access_requests_org_status
  ON public.admin_access_requests(org_id, status, requested_at DESC);

ALTER TABLE public.admin_access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_access_requests_admin_select ON public.admin_access_requests;
CREATE POLICY admin_access_requests_admin_select ON public.admin_access_requests
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());

DROP POLICY IF EXISTS admin_access_requests_own_select ON public.admin_access_requests;
CREATE POLICY admin_access_requests_own_select ON public.admin_access_requests
  FOR SELECT TO authenticated
  USING (requester_id = auth.uid());

DROP POLICY IF EXISTS admin_access_requests_admin_update ON public.admin_access_requests;
CREATE POLICY admin_access_requests_admin_update ON public.admin_access_requests
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());

CREATE OR REPLACE FUNCTION public.request_admin_access()
RETURNS TABLE (
  request_id uuid,
  request_status text,
  org_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_org uuid;
  v_profile public.profiles%ROWTYPE;
  v_request public.admin_access_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to request admin access';
  END IF;

  SELECT email, COALESCE(
    NULLIF(raw_user_meta_data->>'name', ''),
    NULLIF(raw_user_meta_data->>'full_name', ''),
    split_part(email, '@', 1)
  )
  INTO v_email, v_name
  FROM auth.users
  WHERE id = v_uid;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'No email address is attached to this account';
  END IF;

  v_org := public.org_id_for_email(v_email);
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'This email domain is not linked to a workspace';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;

  IF v_profile.id IS NULL THEN
    INSERT INTO public.profiles (id, email, name, role, org_id, status)
    VALUES (v_uid, v_email, v_name, 'pending_admin', v_org, 'active');
  ELSIF v_profile.org_id IS NOT NULL AND v_profile.org_id <> v_org THEN
    RAISE EXCEPTION 'This account belongs to a different workspace';
  ELSIF v_profile.role <> 'admin' THEN
    UPDATE public.profiles
    SET org_id = v_org,
        email = COALESCE(email, v_email),
        name = COALESCE(NULLIF(name, ''), v_name),
        role = 'pending_admin',
        status = 'active'
    WHERE id = v_uid;
  END IF;

  INSERT INTO public.admin_access_requests (
    org_id, requester_id, requester_email, requester_name, status, requested_at,
    resolved_by, resolved_at, resolution_note
  )
  VALUES (v_org, v_uid, v_email, COALESCE(v_name, ''), 'pending', now(), NULL, NULL, '')
  ON CONFLICT (requester_id) DO UPDATE
  SET org_id = EXCLUDED.org_id,
      requester_email = EXCLUDED.requester_email,
      requester_name = EXCLUDED.requester_name,
      status = CASE
        WHEN public.admin_access_requests.status = 'approved' THEN 'approved'
        ELSE 'pending'
      END,
      requested_at = CASE
        WHEN public.admin_access_requests.status = 'approved' THEN public.admin_access_requests.requested_at
        ELSE now()
      END,
      resolved_by = CASE
        WHEN public.admin_access_requests.status = 'approved' THEN public.admin_access_requests.resolved_by
        ELSE NULL
      END,
      resolved_at = CASE
        WHEN public.admin_access_requests.status = 'approved' THEN public.admin_access_requests.resolved_at
        ELSE NULL
      END,
      resolution_note = CASE
        WHEN public.admin_access_requests.status = 'approved' THEN public.admin_access_requests.resolution_note
        ELSE ''
      END
  RETURNING * INTO v_request;

  request_id := v_request.id;
  request_status := v_request.status;
  org_id := v_request.org_id;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.request_admin_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_admin_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_admin_access_request(
  target_request_id uuid,
  decision text,
  note text DEFAULT ''
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.admin_access_requests%ROWTYPE;
  v_decision text := lower(trim(decision));
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can resolve admin access requests';
  END IF;

  IF v_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decision must be approved or rejected';
  END IF;

  SELECT * INTO v_request
  FROM public.admin_access_requests
  WHERE id = target_request_id
    AND org_id = public.current_org_id()
    AND status = 'pending'
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Admin access request not found';
  END IF;

  UPDATE public.admin_access_requests
  SET status = v_decision,
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = COALESCE(note, '')
  WHERE id = v_request.id;

  IF v_decision = 'approved' THEN
    UPDATE public.profiles
    SET role = 'admin',
        status = 'active',
        org_id = v_request.org_id
    WHERE id = v_request.requester_id;
  ELSE
    UPDATE public.profiles
    SET role = 'pending_admin',
        status = 'active',
        org_id = v_request.org_id
    WHERE id = v_request.requester_id
      AND role <> 'admin';
  END IF;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    auth.uid(),
    'admin_access_request_' || v_decision,
    'admin_access_requests',
    v_request.id,
    jsonb_build_object(
      'requester_id', v_request.requester_id,
      'requester_email', v_request.requester_email,
      'decision', v_decision
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_admin_access_request(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_admin_access_request(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  metadata_org uuid := NULLIF(NEW.raw_user_meta_data->>'org_id', '')::uuid;
  resolved_org uuid := metadata_org;
  resolved_role text := 'panelist';
  resolved_name text := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    split_part(NEW.email, '@', 1)
  );
BEGIN
  IF resolved_org IS NULL AND NEW.email IS NOT NULL THEN
    resolved_org := public.org_id_for_email(NEW.email);
    IF resolved_org IS NOT NULL THEN
      resolved_role := 'pending_admin';
    END IF;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, org_id)
  VALUES (NEW.id, NEW.email, resolved_name, resolved_role, resolved_org)
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(public.profiles.email, EXCLUDED.email);

  IF resolved_role = 'pending_admin' AND resolved_org IS NOT NULL THEN
    INSERT INTO public.admin_access_requests (
      org_id, requester_id, requester_email, requester_name, status
    )
    VALUES (resolved_org, NEW.id, NEW.email, COALESCE(resolved_name, ''), 'pending')
    ON CONFLICT (requester_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
