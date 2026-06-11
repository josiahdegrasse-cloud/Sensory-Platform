-- Production hardening: authorization, transactional imports, private concept
-- assets, durable decisions, and server-side workspace controls.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS training_level text NOT NULL DEFAULT 'screened',
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consent_user_agent text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check
      CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_training_level_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_training_level_check
      CHECK (training_level IN ('screened', 'trained', 'certified', 'expert'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.workspace_settings (
  id boolean PRIMARY KEY DEFAULT true,
  workspace_name text NOT NULL DEFAULT 'Sensory Analysis Workspace',
  organization_name text NOT NULL DEFAULT 'New Food Innovation',
  admin_contact_email text,
  default_timezone text NOT NULL DEFAULT 'America/New_York',
  data_retention_months integer NOT NULL DEFAULT 24,
  require_panelist_consent boolean NOT NULL DEFAULT true,
  allow_self_signup boolean NOT NULL DEFAULT true,
  default_panel_size integer NOT NULL DEFAULT 24,
  require_hedonic_section boolean NOT NULL DEFAULT true,
  require_intensity_section boolean NOT NULL DEFAULT true,
  require_emotion_section boolean NOT NULL DEFAULT true,
  allow_panelist_comments boolean NOT NULL DEFAULT true,
  require_all_samples_before_submit boolean NOT NULL DEFAULT true,
  auto_create_food_types boolean NOT NULL DEFAULT true,
  auto_create_surveys_from_imports boolean NOT NULL DEFAULT true,
  require_import_review boolean NOT NULL DEFAULT false,
  duplicate_sample_policy text NOT NULL DEFAULT 'skip',
  require_panelist_id boolean NOT NULL DEFAULT false,
  allow_panelists_view_history boolean NOT NULL DEFAULT false,
  inactive_panelist_days integer NOT NULL DEFAULT 90,
  concept_max_generations_per_concept integer NOT NULL DEFAULT 12,
  concept_monthly_budget_cents integer NOT NULL DEFAULT 2500,
  concept_require_approval boolean NOT NULL DEFAULT false,
  decision_go_threshold integer NOT NULL DEFAULT 75,
  decision_stop_threshold integer NOT NULL DEFAULT 45,
  decision_min_responses integer NOT NULL DEFAULT 12,
  decision_lock_confirmed boolean NOT NULL DEFAULT true,
  anonymize_panelists_in_reports boolean NOT NULL DEFAULT true,
  export_format text NOT NULL DEFAULT 'xlsx',
  report_footer text NOT NULL DEFAULT '',
  notify_on_import boolean NOT NULL DEFAULT true,
  notify_on_completion_target boolean NOT NULL DEFAULT true,
  notify_on_generation_failure boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_settings_singleton CHECK (id = true),
  CONSTRAINT workspace_settings_retention_check CHECK (data_retention_months BETWEEN 1 AND 120),
  CONSTRAINT workspace_settings_default_panel_size_check CHECK (default_panel_size BETWEEN 1 AND 500),
  CONSTRAINT workspace_settings_duplicate_sample_policy_check CHECK (duplicate_sample_policy IN ('skip', 'rename', 'replace')),
  CONSTRAINT workspace_settings_inactive_panelist_days_check CHECK (inactive_panelist_days BETWEEN 1 AND 730),
  CONSTRAINT workspace_settings_concept_limits_check CHECK (
    concept_max_generations_per_concept BETWEEN 1 AND 100
    AND concept_monthly_budget_cents BETWEEN 0 AND 1000000
  ),
  CONSTRAINT workspace_settings_decision_thresholds_check CHECK (
    decision_stop_threshold BETWEEN 0 AND 100
    AND decision_go_threshold BETWEEN 0 AND 100
    AND decision_stop_threshold < decision_go_threshold
    AND decision_min_responses BETWEEN 1 AND 500
  ),
  CONSTRAINT workspace_settings_export_format_check CHECK (export_format IN ('xlsx', 'csv', 'pdf'))
);

INSERT INTO public.workspace_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND status = 'active'
  )
$$;

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_settings_select_admin ON public.workspace_settings;
CREATE POLICY workspace_settings_select_admin ON public.workspace_settings
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS workspace_settings_admin_all ON public.workspace_settings;
CREATE POLICY workspace_settings_admin_all ON public.workspace_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  self_signup_enabled boolean := true;
BEGIN
  SELECT COALESCE(allow_self_signup, true)
  INTO self_signup_enabled
  FROM public.workspace_settings
  WHERE id = true;

  IF NOT self_signup_enabled AND NEW.invited_at IS NULL THEN
    RAISE EXCEPTION 'Self signup is disabled for this workspace';
  END IF;

  INSERT INTO public.profiles (
    id, email, name, role, status, training_level,
    consent_accepted_at, consent_version, consent_user_agent
  )
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'name',
    'panelist',
    'active',
    'screened',
    NULLIF(NEW.raw_user_meta_data->>'consent_accepted_at', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'consent_version', ''),
    NULLIF(NEW.raw_user_meta_data->>'consent_user_agent', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    consent_accepted_at = COALESCE(public.profiles.consent_accepted_at, EXCLUDED.consent_accepted_at),
    consent_version = COALESCE(public.profiles.consent_version, EXCLUDED.consent_version),
    consent_user_agent = COALESCE(public.profiles.consent_user_agent, EXCLUDED.consent_user_agent);

  RETURN NEW;
END;
$$;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS status_before_archive text,
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft', 'active', 'completed', 'archived'));

ALTER TABLE public.import_batches
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS status_before_archive text;

CREATE UNIQUE INDEX IF NOT EXISTS import_batches_idempotency_key_key
  ON public.import_batches(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.decision_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id text NOT NULL,
  sample_name text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('GO', 'TWEAK', 'STOP')),
  issf_score numeric NOT NULL CHECK (issf_score BETWEEN 0 AND 100),
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  note text NOT NULL DEFAULT '',
  method_version text NOT NULL,
  decision_fingerprint text NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_decision_records_created_at
  ON public.decision_records(created_at DESC);

ALTER TABLE public.decision_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decision_records_admin_select ON public.decision_records;
CREATE POLICY decision_records_admin_select ON public.decision_records
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS decision_records_admin_insert ON public.decision_records;
CREATE POLICY decision_records_admin_insert ON public.decision_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND created_by = auth.uid());

-- An audit trail is append-only. Corrections are new records, never destructive edits.
REVOKE UPDATE, DELETE ON public.decision_records FROM authenticated;
