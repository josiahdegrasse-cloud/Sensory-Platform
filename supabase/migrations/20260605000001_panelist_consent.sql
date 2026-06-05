ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consent_user_agent text;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    name,
    role,
    consent_accepted_at,
    consent_version,
    consent_user_agent
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'name',
    'panelist',
    NULLIF(NEW.raw_user_meta_data->>'consent_accepted_at', '')::timestamptz,
    NULLIF(NEW.raw_user_meta_data->>'consent_version', ''),
    NULLIF(NEW.raw_user_meta_data->>'consent_user_agent', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, public.profiles.name),
    consent_accepted_at = COALESCE(public.profiles.consent_accepted_at, EXCLUDED.consent_accepted_at),
    consent_version = COALESCE(public.profiles.consent_version, EXCLUDED.consent_version),
    consent_user_agent = COALESCE(public.profiles.consent_user_agent, EXCLUDED.consent_user_agent);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
