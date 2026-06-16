-- ════════════════════════════════════════════════════════════════════════════
-- Fix handle_new_user(): restore profiles.email population
-- ════════════════════════════════════════════════════════════════════════════
-- 20260610000000_multi_tenancy_foundation replaced handle_new_user() with a
-- version that only inserts (id, name, role, org_id) — dropping the `email`
-- column population added by 20260606000000_production_hardening.
-- 20260612000000_company_email_domains re-defined handle_new_user() again for
-- org-by-domain resolution but carried the same gap forward. Every profile
-- created since then has email = NULL, which silently breaks any feature that
-- emails a user by profile (e.g. notify-survey-assignment skips recipients
-- whose email is null).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resolved_org uuid := NULLIF(NEW.raw_user_meta_data->>'org_id', '')::uuid;
BEGIN
  IF resolved_org IS NULL AND NEW.email IS NOT NULL THEN
    resolved_org := public.org_id_for_email(NEW.email);
  END IF;

  INSERT INTO public.profiles (id, email, name, role, org_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      split_part(NEW.email, '@', 1)
    ),
    'panelist',
    resolved_org
  )
  ON CONFLICT (id) DO UPDATE SET
    email = COALESCE(public.profiles.email, EXCLUDED.email);
  RETURN NEW;
END;
$$;

-- Backfill existing profiles whose email is missing.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL AND u.email IS NOT NULL;
