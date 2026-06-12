-- ════════════════════════════════════════════════════════════════════════════
-- Company email domains → automatic organization assignment at signup
-- ════════════════════════════════════════════════════════════════════════════
-- Depends on 20260610000000_multi_tenancy_foundation (organizations, profiles.
-- org_id, current_org_id(), set_org_id(), is_admin(), handle_new_user()).
--
-- Each organization registers the email domains it owns (acme.com → Acme).
-- handle_new_user() then derives org_id from the signup email's domain when no
-- explicit org_id arrives in user metadata (invite metadata still wins). This
-- applies uniformly to password signups and OAuth (Google) signups, since both
-- insert into auth.users and fire the same trigger.
--
-- Policy choices:
--   * Consumer mailbox domains (gmail.com etc.) can never be registered — a
--     shared mailbox provider must not map a whole domain to one tenant.
--   * Unknown domains do NOT raise here. A trigger exception surfaces as an
--     opaque "Database error saving new user" from GoTrue and would also break
--     service-role provisioning of a new customer's first admin (who must start
--     org-less for provision_organization()). Strictness is enforced at the
--     edges instead: the signup page pre-checks the domain via
--     email_domain_has_workspace(), and the client blocks sign-in for profiles
--     with no org. An org-less profile also sees nothing through RLS
--     (current_org_id() IS NULL matches no rows), so this is defense in depth.
--
-- SAFETY: not run against a live DB. Apply to a preview/branch DB first.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Consumer mailbox denylist ─────────────────────────────────────────────
-- Domains where addresses belong to individuals, not companies. IMMUTABLE so it
-- is usable in a CHECK constraint.
CREATE OR REPLACE FUNCTION public.is_public_email_domain(p_domain text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT lower(p_domain) = ANY (ARRAY[
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com',
    'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'live.co.uk',
    'msn.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com',
    'proton.me', 'protonmail.com', 'pm.me', 'gmx.com', 'gmx.net', 'gmx.de',
    'mail.com', 'mail.ru', 'yandex.com', 'yandex.ru', 'zoho.com',
    'fastmail.com', 'hey.com', 'qq.com', '163.com', '126.com',
    'web.de', 't-online.de', 'orange.fr', 'wanadoo.fr', 'free.fr',
    'btinternet.com', 'sky.com', 'virginmedia.com', 'comcast.net', 'att.net'
  ])
$$;

-- ─── 2. org_email_domains: which company owns which domain ───────────────────
-- domain is the PK: a domain can belong to at most one organization, an
-- organization can register many domains. Stored lowercase only.
CREATE TABLE IF NOT EXISTS public.org_email_domains (
  domain text PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT org_email_domains_lowercase_format
    CHECK (domain = lower(domain) AND domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
  CONSTRAINT org_email_domains_not_public
    CHECK (NOT public.is_public_email_domain(domain))
);

CREATE INDEX IF NOT EXISTS idx_org_email_domains_org ON public.org_email_domains(org_id);

ALTER TABLE public.org_email_domains ENABLE ROW LEVEL SECURITY;

-- Admin inserts may omit org_id; the trigger stamps the caller's org.
DROP TRIGGER IF EXISTS trg_set_org_id ON public.org_email_domains;
CREATE TRIGGER trg_set_org_id BEFORE INSERT ON public.org_email_domains
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

-- Members can see their own org's domains; only admins manage them. No UPDATE
-- policy on purpose — remove and re-add is the only mutation path.
DROP POLICY IF EXISTS org_email_domains_select_own ON public.org_email_domains;
CREATE POLICY org_email_domains_select_own ON public.org_email_domains
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS org_email_domains_admin_insert ON public.org_email_domains;
CREATE POLICY org_email_domains_admin_insert ON public.org_email_domains
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());

DROP POLICY IF EXISTS org_email_domains_admin_delete ON public.org_email_domains;
CREATE POLICY org_email_domains_admin_delete ON public.org_email_domains
  FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin());

-- ─── 3. Lookup helpers ────────────────────────────────────────────────────────
-- org_id_for_email(): the org owning the email's domain, if any. Only matches
-- active organizations so a suspended tenant stops absorbing signups.
CREATE OR REPLACE FUNCTION public.org_id_for_email(p_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT d.org_id
  FROM public.org_email_domains d
  JOIN public.organizations o ON o.id = d.org_id AND o.status = 'active'
  WHERE d.domain = lower(split_part(p_email, '@', 2))
$$;

REVOKE ALL ON FUNCTION public.org_id_for_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.org_id_for_email(text) TO authenticated;

-- email_domain_has_workspace(): anonymous pre-signup check used by the signup
-- page ("is this a company email we know?"). Boolean only — it confirms a
-- domain is registered but never reveals which tenant owns it.
CREATE OR REPLACE FUNCTION public.email_domain_has_workspace(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT public.org_id_for_email(p_email) IS NOT NULL
$$;

REVOKE ALL ON FUNCTION public.email_domain_has_workspace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.email_domain_has_workspace(text) TO anon, authenticated;

-- ─── 4. handle_new_user(): metadata org wins, else company email domain ──────
-- Also reads Google OAuth's `full_name` metadata key (password signups send
-- `name`), falling back to the email local part so profiles are never nameless.
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

  INSERT INTO public.profiles (id, name, role, org_id)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      split_part(NEW.email, '@', 1)
    ),
    'panelist',
    resolved_org
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ─── 5. Backfill: adopt org-less profiles whose domain is registered ─────────
-- No-op while org_email_domains is empty; correct if this migration is re-run
-- after domains exist (e.g. on a preview branch seeded with domains).
UPDATE public.profiles p
SET org_id = d.org_id
FROM auth.users u
JOIN public.org_email_domains d ON d.domain = lower(split_part(u.email, '@', 2))
WHERE p.id = u.id AND p.org_id IS NULL;
