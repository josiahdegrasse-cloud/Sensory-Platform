-- Seed fermIQ food as the first branded tenant while the public wildcard
-- domain is still pending. This migration is idempotent: it preserves all
-- operational settings and only refreshes the known identity fields.

DO $$
DECLARE
  v_org_id uuid;
  v_operator_id uuid;
  v_existing_user_id uuid;
  v_existing_user_org_id uuid;
BEGIN
  INSERT INTO public.organizations (name, slug, status)
  VALUES ('FermIQ Food', 'fermiq', 'active')
  ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name,
      status = 'active'
  RETURNING id INTO v_org_id;

  INSERT INTO public.workspace_settings (
    org_id,
    workspace_name,
    organization_name,
    admin_contact_email,
    logo_url,
    primary_color,
    accent_color,
    report_tone,
    default_report_title,
    report_template,
    report_footer
  )
  VALUES (
    v_org_id,
    'FermIQ Food',
    'FermIQ Food',
    'contact@fermiq.uk',
    '/fermiq-food-logo.png',
    '#0E3A5F',
    '#5EB12E',
    'standard',
    '{sample} evidence and commercialization report',
    'standard',
    'Confidential — prepared for FermIQ Food'
  )
  ON CONFLICT (org_id) DO UPDATE
  SET admin_contact_email = COALESCE(
        public.workspace_settings.admin_contact_email,
        EXCLUDED.admin_contact_email
      ),
      updated_at = now();

  INSERT INTO public.org_email_domains (domain, org_id)
  VALUES ('fermiq.uk', v_org_id)
  ON CONFLICT (domain) DO UPDATE
  SET org_id = EXCLUDED.org_id;

  SELECT po.user_id
  INTO v_operator_id
  FROM public.platform_operators po
  ORDER BY po.created_at, po.user_id
  LIMIT 1;

  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'No platform operator exists to sponsor the fermIQ bootstrap administrator';
  END IF;

  INSERT INTO public.organization_admin_bootstrap_invites (
    org_id,
    email,
    invited_by
  )
  VALUES (
    v_org_id,
    'contact@fermiq.uk',
    v_operator_id
  )
  ON CONFLICT (org_id, email) DO NOTHING;

  SELECT u.id, p.org_id
  INTO v_existing_user_id, v_existing_user_org_id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE lower(u.email) = 'contact@fermiq.uk'
  LIMIT 1;

  IF v_existing_user_id IS NOT NULL AND v_existing_user_org_id IS NULL THEN
    UPDATE public.profiles
    SET org_id = v_org_id,
        role = 'admin',
        status = 'active',
        email = COALESCE(email, 'contact@fermiq.uk')
    WHERE id = v_existing_user_id;
  ELSIF v_existing_user_id IS NOT NULL AND v_existing_user_org_id <> v_org_id THEN
    RAISE EXCEPTION 'The fermIQ administrator email already belongs to another workspace';
  END IF;

  INSERT INTO public.audit_events (
    actor_id,
    event_type,
    entity_type,
    entity_id,
    org_id,
    metadata
  )
  VALUES (
    v_operator_id,
    'platform_organization_brand_seeded',
    'organizations',
    v_org_id,
    (SELECT p.org_id FROM public.profiles p WHERE p.id = v_operator_id),
    jsonb_build_object(
      'organization_name', 'FermIQ Food',
      'organization_slug', 'fermiq',
      'administrator_email', 'contact@fermiq.uk',
      'email_domains', ARRAY['fermiq.uk'],
      'brand_primary', '#0E3A5F',
      'brand_accent', '#5EB12E'
    )
  );
END
$$;
