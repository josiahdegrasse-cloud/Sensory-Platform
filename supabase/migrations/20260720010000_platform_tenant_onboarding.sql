-- Controlled, audited tenant onboarding for the multi-brand platform.
--
-- Only explicitly seeded platform operators can create organizations. The
-- designated first administrator is promoted exactly once when that email
-- creates its account, avoiding service-role credentials in the browser and
-- avoiding the "new workspace has nobody who can approve its first admin"
-- deadlock.

CREATE TABLE public.platform_operators (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.platform_operators ENABLE ROW LEVEL SECURITY;

-- Bootstrap only the active admins of the original platform organization.
-- Future tenant admins are never added automatically.
INSERT INTO public.platform_operators (user_id)
SELECT p.id
FROM public.profiles p
JOIN public.organizations o ON o.id = p.org_id
WHERE o.slug = 'nfi'
  AND p.role = 'admin'
  AND p.status = 'active'
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_platform_operator()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_operators po
    JOIN public.profiles p ON p.id = po.user_id
    JOIN public.organizations o ON o.id = p.org_id
    WHERE po.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.status = 'active'
      AND o.status = 'active'
  )
$$;

REVOKE ALL ON FUNCTION public.is_platform_operator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_operator() TO authenticated;

CREATE POLICY platform_operators_select_self ON public.platform_operators
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE TABLE public.organization_admin_bootstrap_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz,
  claimed_by uuid,
  CONSTRAINT organization_admin_bootstrap_invites_email_lowercase
    CHECK (email = lower(email)),
  UNIQUE (org_id, email)
);

CREATE UNIQUE INDEX organization_admin_bootstrap_invites_one_open_email
  ON public.organization_admin_bootstrap_invites(email)
  WHERE claimed_at IS NULL;

ALTER TABLE public.organization_admin_bootstrap_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_admin_bootstrap_invites_platform_select
  ON public.organization_admin_bootstrap_invites
  FOR SELECT TO authenticated
  USING (public.is_platform_operator());

-- The auth user exists by the time handle_new_user inserts its profile. This
-- BEFORE trigger claims the matching one-use bootstrap invitation and makes
-- that exact person the first admin of the new organization.
CREATE OR REPLACE FUNCTION public.claim_organization_admin_bootstrap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_invite public.organization_admin_bootstrap_invites%ROWTYPE;
BEGIN
  SELECT lower(u.email)
  INTO v_email
  FROM auth.users u
  WHERE u.id = NEW.id;

  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT i.*
  INTO v_invite
  FROM public.organization_admin_bootstrap_invites i
  JOIN public.organizations o ON o.id = i.org_id AND o.status = 'active'
  WHERE i.email = v_email
    AND i.claimed_at IS NULL
  ORDER BY i.created_at
  LIMIT 1
  FOR UPDATE OF i;

  IF v_invite.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.org_id IS NOT NULL AND NEW.org_id <> v_invite.org_id THEN
    RAISE EXCEPTION 'Bootstrap administrator belongs to a different workspace';
  END IF;

  NEW.org_id := v_invite.org_id;
  NEW.role := 'admin';
  NEW.status := 'active';
  NEW.email := COALESCE(NEW.email, v_email);

  UPDATE public.organization_admin_bootstrap_invites
  SET claimed_at = now(), claimed_by = NEW.id
  WHERE id = v_invite.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_claim_organization_admin_bootstrap ON public.profiles;
CREATE TRIGGER trg_claim_organization_admin_bootstrap
  BEFORE INSERT OR UPDATE OF org_id, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.claim_organization_admin_bootstrap();

CREATE OR REPLACE FUNCTION public.platform_provision_organization(
  p_org_name text,
  p_org_slug text,
  p_admin_email text,
  p_email_domains text[],
  p_workspace_name text DEFAULT NULL,
  p_logo_url text DEFAULT NULL,
  p_primary_color text DEFAULT NULL,
  p_accent_color text DEFAULT NULL
)
RETURNS TABLE (
  organization_id uuid,
  organization_slug text,
  administrator_email text,
  sign_in_host text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_name text := trim(p_org_name);
  v_org_slug text := lower(trim(p_org_slug));
  v_admin_email text := lower(trim(p_admin_email));
  v_admin_domain text;
  v_domains text[];
  v_domain text;
  v_org_id uuid;
  v_existing_user uuid;
  v_existing_org uuid;
BEGIN
  IF NOT public.is_platform_operator() THEN
    RAISE EXCEPTION 'Only platform operators can provision organizations';
  END IF;

  IF length(v_org_name) < 2 OR length(v_org_name) > 120 THEN
    RAISE EXCEPTION 'Organization name must be between 2 and 120 characters';
  END IF;
  IF v_org_slug !~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
     OR v_org_slug IN ('www', 'app') THEN
    RAISE EXCEPTION 'Organization slug is invalid or reserved';
  END IF;
  IF v_admin_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN
    RAISE EXCEPTION 'Administrator email is invalid';
  END IF;

  v_admin_domain := split_part(v_admin_email, '@', 2);
  SELECT array_agg(DISTINCT lower(trim(domain_value)) ORDER BY lower(trim(domain_value)))
  INTO v_domains
  FROM unnest(COALESCE(p_email_domains, ARRAY[]::text[])) AS domains(domain_value)
  WHERE trim(domain_value) <> '';

  IF COALESCE(array_length(v_domains, 1), 0) = 0 THEN
    RAISE EXCEPTION 'At least one company email domain is required';
  END IF;
  IF NOT (v_admin_domain = ANY(v_domains)) THEN
    RAISE EXCEPTION 'Administrator email domain must be registered to the organization';
  END IF;

  FOREACH v_domain IN ARRAY v_domains LOOP
    IF v_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
       OR public.is_public_email_domain(v_domain) THEN
      RAISE EXCEPTION 'Company email domain is invalid or public: %', v_domain;
    END IF;
  END LOOP;

  IF p_primary_color IS NOT NULL AND trim(p_primary_color) !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Primary color must be a six-digit hex color';
  END IF;
  IF p_accent_color IS NOT NULL AND trim(p_accent_color) !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Accent color must be a six-digit hex color';
  END IF;

  SELECT u.id, p.org_id
  INTO v_existing_user, v_existing_org
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = v_admin_email
  LIMIT 1;

  IF v_existing_user IS NOT NULL AND v_existing_org IS NOT NULL THEN
    RAISE EXCEPTION 'Administrator email already belongs to a workspace';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (v_org_name, v_org_slug)
  RETURNING id INTO v_org_id;

  INSERT INTO public.workspace_settings (
    org_id,
    workspace_name,
    organization_name,
    admin_contact_email,
    logo_url,
    primary_color,
    accent_color
  )
  VALUES (
    v_org_id,
    COALESCE(NULLIF(trim(p_workspace_name), ''), v_org_name || ' Sensory Workspace'),
    v_org_name,
    v_admin_email,
    NULLIF(trim(p_logo_url), ''),
    NULLIF(trim(p_primary_color), ''),
    NULLIF(trim(p_accent_color), '')
  );

  FOREACH v_domain IN ARRAY v_domains LOOP
    INSERT INTO public.org_email_domains (domain, org_id)
    VALUES (v_domain, v_org_id);
  END LOOP;

  INSERT INTO public.organization_admin_bootstrap_invites (
    org_id, email, invited_by
  )
  VALUES (v_org_id, v_admin_email, auth.uid());

  -- If the administrator already created an org-less account, claim it now.
  IF v_existing_user IS NOT NULL THEN
    UPDATE public.profiles
    SET org_id = v_org_id,
        role = 'admin',
        status = 'active',
        email = COALESCE(email, v_admin_email)
    WHERE id = v_existing_user
      AND org_id IS NULL;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, org_id, metadata
  )
  VALUES (
    auth.uid(),
    'platform_organization_provisioned',
    'organizations',
    v_org_id,
    public.current_org_id(),
    jsonb_build_object(
      'organization_name', v_org_name,
      'organization_slug', v_org_slug,
      'administrator_email', v_admin_email,
      'email_domains', v_domains
    )
  );

  organization_id := v_org_id;
  organization_slug := v_org_slug;
  administrator_email := v_admin_email;
  sign_in_host := v_org_slug;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.platform_provision_organization(
  text, text, text, text[], text, text, text, text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.platform_provision_organization(
  text, text, text, text[], text, text, text, text
) TO authenticated;

-- Close the earlier open self-provisioning path. Service-role/database owners
-- retain control, but ordinary authenticated accounts can no longer call it.
REVOKE EXECUTE ON FUNCTION public.provision_organization(text, text) FROM authenticated;

COMMENT ON FUNCTION public.platform_provision_organization(
  text, text, text, text[], text, text, text, text
) IS 'Atomically creates a tenant, settings, domains, and one-use first-admin bootstrap invitation for a platform operator.';
