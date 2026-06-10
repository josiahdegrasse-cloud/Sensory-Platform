-- ════════════════════════════════════════════════════════════════════════════
-- Multi-tenancy foundation
-- ════════════════════════════════════════════════════════════════════════════
-- Turns the single-workspace app into an isolated-per-company (tenant) platform.
-- Each organization's admins + panelists can only ever see their own org's data.
--
-- Design choices (deliberate, see PR notes):
--   1. Tenant isolation is added as an ADDITIVE `AS RESTRICTIVE` RLS layer. It is
--      AND-ed with every existing permissive policy, so none of the prior,
--      carefully-tuned role/ownership/status rules (incl. the security_fixes
--      migration) are rewritten or at risk of regression.
--   2. `org_id` is auto-stamped on INSERT by a trigger that reads the caller's
--      org. This fires even inside the SECURITY DEFINER RPCs (create_instrumental_
--      import etc.), so their bodies need no change for normal (user-JWT) paths.
--   3. Two DEFINER functions that mutate BY id/slug bypass RLS, so they get an
--      explicit org guard below.
--
-- Statement ordering matters: organizations must exist before any org_id FK;
-- profiles.org_id must exist before current_org_id() (a SQL function whose body
-- is validated at creation); current_org_id() must exist before any policy or
-- trigger that references it.
--
-- NOT covered here (require coordinated app changes — see PR notes):
--   • workspace_settings / concept_generation_settings are still singletons
--     (`id = true`). Making them per-org needs the `.eq('id', true)` call sites
--     in src/app/lib/db/workspace.ts + concepts.ts updated.
--   • The concept-image edge function inserts via the SERVICE ROLE (no user JWT),
--     so the trigger can't derive org there — it must pass org_id explicitly.
--   • get_public_workspace_config() is anonymous (pre-login); resolving WHICH
--     tenant's config to show needs a tenant key (e.g. subdomain). Left as-is.
--
-- SAFETY: This has not been run against a live database. Apply it to a Supabase
-- preview/branch DB first and run the verification queries in the PR notes.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Organizations (tenants) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Seed the existing data's home organization. Every current row backfills here.
INSERT INTO public.organizations (id, name, slug)
VALUES ('11111111-1111-1111-1111-111111111111', 'New Food Innovation', 'nfi')
ON CONFLICT (slug) DO NOTHING;

-- ─── 2. profiles.org_id column (the org anchor) ──────────────────────────────
-- Added before current_org_id() so that function's body validates. Populated by
-- handle_new_user() at signup (not the generic trigger), since current_org_id()
-- reads profiles for auth.uid(), which does not exist mid-insert of own profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

UPDATE public.profiles
  SET org_id = '11111111-1111-1111-1111-111111111111'
  WHERE org_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(org_id);

-- ─── 3. Helpers (policies + triggers below depend on them) ───────────────────
-- current_org_id(): the calling user's organization. SECURITY DEFINER so it
-- reads profiles regardless of RLS (and avoids policy recursion); STABLE so the
-- planner caches it within a statement. auth.uid() resolves to the caller even
-- inside other DEFINER functions, which is what lets the insert trigger work.
CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT org_id FROM public.profiles WHERE id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_org_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;

-- set_org_id(): stamp org_id on insert from the caller's org when not supplied.
CREATE OR REPLACE FUNCTION public.set_org_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.org_id IS NULL THEN
    NEW.org_id := public.current_org_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ─── 4. Organization + profile isolation policies ────────────────────────────
DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
CREATE POLICY organizations_select_own ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.current_org_id());

DROP POLICY IF EXISTS org_isolation ON public.profiles;
CREATE POLICY org_isolation ON public.profiles
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

-- ─── 5. Uniform tenant tables: org_id + backfill + index + trigger + isolation
-- Every table here holds tenant-owned operational data with no cross-tenant
-- sharing, so a single FOR ALL restrictive policy is correct.
DO $$
DECLARE
  t text;
  default_org constant uuid := '11111111-1111-1111-1111-111111111111';
  tenant_tables constant text[] := ARRAY[
    'products', 'responses', 'templates', 'concept_tests', 'concept_responses',
    'import_batches', 'instrumental_samples', 'e_tongue_measurements',
    'gcms_compounds', 'composition_profiles', 'audit_events', 'decision_records',
    'commercialization_reports', 'concept_images', 'concept_image_generations',
    'import_mapping_presets'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT',
      t);
    EXECUTE format(
      'UPDATE public.%I SET org_id = %L WHERE org_id IS NULL',
      t, default_org);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(org_id)',
      'idx_' || t || '_org', t);

    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_org_id ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_org_id()',
      t);

    EXECUTE format('DROP POLICY IF EXISTS org_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY org_isolation ON public.%I AS RESTRICTIVE FOR ALL TO authenticated '
      'USING (org_id = public.current_org_id()) '
      'WITH CHECK (org_id = public.current_org_id())',
      t);
  END LOOP;
END $$;

-- ─── 6. food_types: special-cased (system rows are GLOBAL reference data) ─────
-- System food types (cheese, bread, …) have org_id = NULL and are visible to
-- every tenant. Tenant-created (import/manual) types are org-scoped. SELECT may
-- read globals; INSERT/UPDATE/DELETE are confined to the caller's own org so a
-- tenant can never mutate shared reference data.
ALTER TABLE public.food_types
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organizations(id) ON DELETE RESTRICT;

UPDATE public.food_types
  SET org_id = '11111111-1111-1111-1111-111111111111'
  WHERE org_id IS NULL AND source <> 'system';

CREATE INDEX IF NOT EXISTS idx_food_types_org ON public.food_types(org_id);

DROP TRIGGER IF EXISTS trg_set_org_id ON public.food_types;
CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.food_types
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

-- Slugs are unique globally for system rows and per-org for tenant rows.
ALTER TABLE public.food_types DROP CONSTRAINT IF EXISTS food_types_slug_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_types_global_slug
  ON public.food_types(slug) WHERE org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_food_types_org_slug
  ON public.food_types(org_id, slug) WHERE org_id IS NOT NULL;

DROP POLICY IF EXISTS org_isolation_select ON public.food_types;
CREATE POLICY org_isolation_select ON public.food_types
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (org_id IS NULL OR org_id = public.current_org_id());

DROP POLICY IF EXISTS org_isolation_insert ON public.food_types;
CREATE POLICY org_isolation_insert ON public.food_types
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS org_isolation_update ON public.food_types;
CREATE POLICY org_isolation_update ON public.food_types
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS org_isolation_delete ON public.food_types;
CREATE POLICY org_isolation_delete ON public.food_types
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (org_id = public.current_org_id());

-- ─── 7. Org-aware signup ─────────────────────────────────────────────────────
-- New users join an org via signup metadata `org_id` (set by an invite link or
-- the org-provisioning flow). A user with no org_id can authenticate but every
-- RLS check fails closed, so they see nothing until assigned to an org.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, org_id)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    'panelist',
    NULLIF(NEW.raw_user_meta_data->>'org_id', '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- provision_organization(): create a new company + make the caller its first
-- admin. Used when onboarding a new customer. DEFINER so it can write the org
-- row and elevate the caller within their brand-new org only.
CREATE OR REPLACE FUNCTION public.provision_organization(
  org_name text,
  org_slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_org_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to provision an organization';
  END IF;
  -- Refuse if the caller already belongs to an org (prevents takeover).
  IF public.current_org_id() IS NOT NULL THEN
    RAISE EXCEPTION 'User already belongs to an organization';
  END IF;

  INSERT INTO public.organizations (name, slug)
  VALUES (org_name, org_slug)
  RETURNING id INTO new_org_id;

  UPDATE public.profiles
  SET org_id = new_org_id, role = 'admin'
  WHERE id = auth.uid();

  RETURN new_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_organization(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_organization(text, text) TO authenticated;

-- ─── 8. Org guards on DEFINER functions that mutate BY id/slug ───────────────
-- These bypass RLS, so without an explicit guard an admin could pass another
-- org's id/slug. The cascade UPDATE/DELETEs are already keyed off the target
-- row, so guarding the lookup is sufficient.

-- set_import_batch_status: confirm the batch is in the caller's org first.
CREATE OR REPLACE FUNCTION public.set_import_batch_status(
  target_batch_id uuid,
  next_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can manage import batches';
  END IF;
  IF next_status NOT IN ('active', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'Invalid import batch status';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.import_batches
    WHERE id = target_batch_id AND org_id = public.current_org_id()
  ) THEN
    RAISE EXCEPTION 'Import batch not found';
  END IF;

  IF next_status = 'archived' THEN
    UPDATE public.import_batches
    SET status_before_archive = status, status = 'archived', archived_at = now(), deleted_at = NULL
    WHERE id = target_batch_id AND status <> 'archived';
  ELSIF next_status = 'active' THEN
    UPDATE public.import_batches
    SET status = COALESCE(status_before_archive, 'active'),
        status_before_archive = NULL,
        archived_at = NULL,
        deleted_at = NULL
    WHERE id = target_batch_id;
  ELSE
    UPDATE public.import_batches
    SET status = 'deleted', status_before_archive = NULL, deleted_at = now()
    WHERE id = target_batch_id;
  END IF;

  IF next_status = 'deleted' THEN
    DELETE FROM public.products
    WHERE source_import_batch_id = target_batch_id;
  ELSIF next_status = 'archived' THEN
    UPDATE public.products
    SET status_before_archive = status, status = 'archived'
    WHERE source_import_batch_id = target_batch_id
      AND status <> 'archived';
  ELSE
    UPDATE public.products
    SET status = COALESCE(status_before_archive, 'active'), status_before_archive = NULL
    WHERE source_import_batch_id = target_batch_id;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    auth.uid(),
    'import_batch_status_updated',
    'import_batches',
    target_batch_id,
    jsonb_build_object('status', next_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_import_batch_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_import_batch_status(uuid, text) TO authenticated;

-- set_food_type_status: scope the slug lookup to the caller's org so a tenant
-- can only manage its own food types (never global/system rows or another org's).
CREATE OR REPLACE FUNCTION public.set_food_type_status(
  target_slug text,
  next_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_food_type_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can manage food types';
  END IF;
  IF next_status NOT IN ('active', 'archived', 'deleted') THEN
    RAISE EXCEPTION 'Invalid food type status';
  END IF;

  SELECT id
  INTO target_food_type_id
  FROM public.food_types
  WHERE slug = target_slug
    AND org_id = public.current_org_id()
  FOR UPDATE;

  IF target_food_type_id IS NULL THEN
    RAISE EXCEPTION 'Food type not found';
  END IF;

  UPDATE public.food_types
  SET status = next_status, updated_at = now()
  WHERE id = target_food_type_id;

  IF next_status = 'archived' THEN
    UPDATE public.import_batches
    SET status_before_archive = status, status = 'archived', archived_at = now()
    WHERE food_type_id = target_food_type_id
      AND status NOT IN ('archived', 'deleted');
  ELSIF next_status = 'active' THEN
    UPDATE public.import_batches
    SET status = COALESCE(status_before_archive, 'active'),
        status_before_archive = NULL,
        archived_at = NULL
    WHERE food_type_id = target_food_type_id
      AND status = 'archived';
  ELSE
    UPDATE public.import_batches
    SET status = 'deleted', status_before_archive = NULL, deleted_at = now()
    WHERE food_type_id = target_food_type_id;
  END IF;

  IF next_status = 'deleted' THEN
    DELETE FROM public.products p
    USING public.import_batches b
    WHERE p.source_import_batch_id = b.id
      AND b.food_type_id = target_food_type_id;
  ELSIF next_status = 'archived' THEN
    UPDATE public.products p
    SET status_before_archive = p.status, status = 'archived'
    FROM public.import_batches b
    WHERE p.source_import_batch_id = b.id
      AND b.food_type_id = target_food_type_id
      AND p.status <> 'archived';
  ELSE
    UPDATE public.products p
    SET status = COALESCE(p.status_before_archive, 'active'),
        status_before_archive = NULL
    FROM public.import_batches b
    WHERE p.source_import_batch_id = b.id
      AND b.food_type_id = target_food_type_id;
  END IF;

  INSERT INTO public.audit_events (
    actor_id, event_type, entity_type, entity_id, metadata
  )
  VALUES (
    auth.uid(),
    'food_type_status_updated',
    'food_types',
    target_food_type_id,
    jsonb_build_object('slug', target_slug, 'status', next_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_food_type_status(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_food_type_status(text, text) TO authenticated;
