-- ════════════════════════════════════════════════════════════════════════════
-- Per-organization settings + branding
-- ════════════════════════════════════════════════════════════════════════════
-- Depends on 20260610000000_multi_tenancy_foundation (organizations,
-- current_org_id(), set_org_id(), the seed org). Converts the two singleton
-- settings tables to one row per organization so each tenant has its own
-- workspace config, decision thresholds, image budget, and branding.
--
-- Reads rely on the additive RESTRICTIVE org_isolation policy (RLS returns only
-- the caller's org row). Writes go through SECURITY DEFINER upsert RPCs that
-- derive org_id from current_org_id(), so the client never needs to know its
-- org. The anonymous get_public_workspace_config() is reworked to resolve a
-- tenant by org slug (for a future subdomain/branded login).
--
-- SAFETY: not run against a live DB. Apply to a preview/branch DB first.
-- ════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN PERFORM 1; END $$;  -- no-op anchor; keeps psql happy if re-run

-- ─── workspace_settings: singleton (id = true) → one row per org ─────────────
ALTER TABLE public.workspace_settings DROP CONSTRAINT IF EXISTS workspace_settings_singleton;
ALTER TABLE public.workspace_settings DROP CONSTRAINT IF EXISTS workspace_settings_pkey;

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

-- Branding (per tenant; consumed by subdomain theming + branded login later).
ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS primary_color text,
  ADD COLUMN IF NOT EXISTS accent_color text;

-- The existing single row belongs to the seed organization.
UPDATE public.workspace_settings
  SET org_id = '11111111-1111-1111-1111-111111111111'
  WHERE org_id IS NULL;

-- Retire the boolean singleton key; org_id is the identity now.
ALTER TABLE public.workspace_settings DROP COLUMN IF EXISTS id;
ALTER TABLE public.workspace_settings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.workspace_settings ADD CONSTRAINT workspace_settings_pkey PRIMARY KEY (org_id);

DROP TRIGGER IF EXISTS trg_set_org_id ON public.workspace_settings;
CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.workspace_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

-- Tenant isolation layered on top of the existing is_admin() permissive policies.
DROP POLICY IF EXISTS org_isolation ON public.workspace_settings;
CREATE POLICY org_isolation ON public.workspace_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

-- ─── concept_generation_settings: one active row per org ─────────────────────
ALTER TABLE public.concept_generation_settings
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

UPDATE public.concept_generation_settings
  SET org_id = '11111111-1111-1111-1111-111111111111'
  WHERE org_id IS NULL;

-- At most one active settings row per organization.
DROP INDEX IF EXISTS public.idx_concept_generation_settings_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_concept_generation_settings_active_org
  ON public.concept_generation_settings(org_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_concept_generation_settings_org
  ON public.concept_generation_settings(org_id);

DROP TRIGGER IF EXISTS trg_set_org_id ON public.concept_generation_settings;
CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.concept_generation_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

DROP POLICY IF EXISTS org_isolation ON public.concept_generation_settings;
CREATE POLICY org_isolation ON public.concept_generation_settings
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

-- ─── Write path: org-deriving upsert RPCs ────────────────────────────────────
-- The client passes the validated patch (snake_case keys = column names); the
-- function forces org_id from current_org_id() and preserves created_at. A
-- delete+insert (atomic within the function) avoids enumerating ~35 columns.
CREATE OR REPLACE FUNCTION public.upsert_workspace_settings(patch jsonb)
RETURNS public.workspace_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_org uuid := public.current_org_id();
  existing_created timestamptz;
  result public.workspace_settings;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only administrators can update workspace settings';
  END IF;
  IF caller_org IS NULL THEN
    RAISE EXCEPTION 'No organization context for workspace settings';
  END IF;

  SELECT created_at INTO existing_created
  FROM public.workspace_settings WHERE org_id = caller_org;

  DELETE FROM public.workspace_settings WHERE org_id = caller_org;

  INSERT INTO public.workspace_settings
  SELECT (jsonb_populate_record(
    NULL::public.workspace_settings,
    patch
      || jsonb_build_object('org_id', caller_org)
      || jsonb_build_object('created_at', COALESCE(existing_created, now()))
  )).*
  RETURNING * INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.upsert_workspace_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_workspace_settings(jsonb) TO authenticated;

-- concept_generation_settings has no upsert RPC: the existing fetch-then-
-- insert/update path in db/concepts.ts already works per-org via the set_org_id
-- trigger + the org_isolation RLS policy above (the INSERT is stamped with the
-- caller's org; updates are RLS-scoped to it).

-- ─── Anonymous public config, resolved by org slug ───────────────────────────
-- Pre-login (no org context yet). A future subdomain/branded login passes the
-- tenant's slug; with no slug it returns platform defaults so the generic login
-- page keeps working. DEFINER + bounded columns only (never leaks tenant data).
DROP FUNCTION IF EXISTS public.get_public_workspace_config();
CREATE OR REPLACE FUNCTION public.get_public_workspace_config(org_slug text DEFAULT NULL)
RETURNS TABLE (
  workspace_name text,
  allow_self_signup boolean,
  logo_url text,
  primary_color text,
  accent_color text
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT
    COALESCE(ws.workspace_name, 'Sensory Analysis Workspace'),
    COALESCE(ws.allow_self_signup, true),
    ws.logo_url,
    ws.primary_color,
    ws.accent_color
  FROM public.organizations o
  JOIN public.workspace_settings ws ON ws.org_id = o.id
  WHERE org_slug IS NOT NULL AND o.slug = org_slug AND o.status = 'active'

  UNION ALL

  SELECT 'Sensory Analysis Workspace', true, NULL::text, NULL::text, NULL::text
  WHERE org_slug IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.organizations o2 WHERE o2.slug = org_slug AND o2.status = 'active'
     )

  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_public_workspace_config(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_workspace_config(text) TO anon, authenticated;
