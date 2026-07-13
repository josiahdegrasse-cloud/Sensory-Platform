-- Allow Supabase Auth's internal hook executor to resolve the tenant and role
-- used by public.custom_access_token_hook(jsonb).
--
-- Table-level SELECT grants alone are not sufficient because both relations
-- enforce RLS and supabase_auth_admin does not bypass it. These policies apply
-- only to Supabase's internal Auth role; anon and authenticated users retain
-- their existing policies and cannot execute the hook function directly.

DROP POLICY IF EXISTS supabase_auth_admin_read_profiles_for_token_hook
  ON public.profiles;

CREATE POLICY supabase_auth_admin_read_profiles_for_token_hook
  ON public.profiles
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

DROP POLICY IF EXISTS supabase_auth_admin_read_organizations_for_token_hook
  ON public.organizations;

CREATE POLICY supabase_auth_admin_read_organizations_for_token_hook
  ON public.organizations
  FOR SELECT
  TO supabase_auth_admin
  USING (true);

COMMENT ON POLICY supabase_auth_admin_read_profiles_for_token_hook
  ON public.profiles IS
  'Allows the internal Supabase Auth role to resolve user role and organization for the custom access-token hook.';

COMMENT ON POLICY supabase_auth_admin_read_organizations_for_token_hook
  ON public.organizations IS
  'Allows the internal Supabase Auth role to resolve organization slug for the custom access-token hook.';
