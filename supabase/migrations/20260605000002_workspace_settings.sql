ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS training_level text NOT NULL DEFAULT 'screened';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'inactive', 'archived'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_training_level_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_training_level_check CHECK (training_level IN ('screened', 'trained', 'certified', 'expert'));
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
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_settings_singleton CHECK (id = true),
  CONSTRAINT workspace_settings_retention_check CHECK (data_retention_months BETWEEN 1 AND 120)
);

INSERT INTO public.workspace_settings (id)
VALUES (true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_settings_select_admin ON public.workspace_settings;
CREATE POLICY workspace_settings_select_admin ON public.workspace_settings
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS workspace_settings_admin_all ON public.workspace_settings;
CREATE POLICY workspace_settings_admin_all ON public.workspace_settings
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_audit_events_created_at ON public.audit_events(created_at DESC);

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    role,
    status,
    training_level,
    consent_accepted_at,
    consent_version,
    consent_user_agent
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
    status = COALESCE(public.profiles.status, EXCLUDED.status),
    training_level = COALESCE(public.profiles.training_level, EXCLUDED.training_level),
    consent_accepted_at = COALESCE(public.profiles.consent_accepted_at, EXCLUDED.consent_accepted_at),
    consent_version = COALESCE(public.profiles.consent_version, EXCLUDED.consent_version),
    consent_user_agent = COALESCE(public.profiles.consent_user_agent, EXCLUDED.consent_user_agent);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
