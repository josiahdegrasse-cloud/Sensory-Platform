-- ════════════════════════════════════════════════════════════════════════════
-- RAG service access token hook
-- ════════════════════════════════════════════════════════════════════════════
-- Injects `tenant_id` (the caller's org slug) and `roles` into every JWT this
-- Supabase project issues, so the separate RAG service (rag_food/auth.py,
-- OIDCValidator + principal_from_claims) can authenticate a user from the
-- token alone without a second lookup.
--
-- IMPORTANT — this hook is GLOBAL, not RAG-specific:
-- Supabase Custom Access Token Hooks fire for every token issued by this
-- project, including the dashboard's own existing login flow. That's
-- deliberate — it's the only way to reach the RAG service's OAuth Server
-- flow too — but it means this function must never break a real dashboard
-- login. The dashboard's own code reads org/role from `profiles` directly
-- via auth.uid(), never from JWT claims, so adding these claims is purely
-- additive to it: nothing existing reads or depends on them.
--
-- Failure mode: if anything below can't resolve (no profile row yet, no
-- org assigned, unexpected error), the function returns the ORIGINAL event
-- unmodified rather than raising — a broken hook that raises blocks login
-- for every user in the project, which is a far worse outcome than a token
-- simply missing these two optional claims.
--
-- MANUAL STEP (cannot be done from SQL): after this migration is applied,
-- register the function in the Supabase dashboard —
-- Authentication → Hooks (Beta) → Customize Access Token (Auth Hook) →
-- select `public.custom_access_token_hook`.
--
-- SAFETY: Not yet applied. Review, then apply via a Supabase preview/branch
-- DB before the production project — this one especially, since a bug here
-- affects every login, not just the RAG service's.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  caller_id uuid;
  caller_org_slug text;
  caller_role text;
  rag_role text;
BEGIN
  claims := event->'claims';
  caller_id := (event->>'user_id')::uuid;

  SELECT o.slug, p.role
    INTO caller_org_slug, caller_role
  FROM public.profiles p
  JOIN public.organizations o ON o.id = p.org_id
  WHERE p.id = caller_id;

  -- No profile yet, no org assigned, or any lookup surprise: return the
  -- event exactly as Supabase built it. A missing tenant_id/roles claim is
  -- recoverable; a raised exception here blocks every login project-wide.
  IF caller_org_slug IS NULL THEN
    RETURN event;
  END IF;

  -- Simple 2-tier mapping (see project notes): dashboard admins get full
  -- RAG access, everyone else is read-only. Revisit if a real "researcher"
  -- tier is ever needed independent of dashboard admin status.
  rag_role := CASE WHEN caller_role = 'admin' THEN 'admin' ELSE 'viewer' END;

  claims := jsonb_set(claims, '{tenant_id}', to_jsonb(caller_org_slug));
  claims := jsonb_set(claims, '{roles}', to_jsonb(rag_role));

  RETURN jsonb_set(event, '{claims}', claims);
EXCEPTION WHEN OTHERS THEN
  RETURN event;
END;
$$;

REVOKE ALL ON FUNCTION public.custom_access_token_hook(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- Supabase's own hook docs pair this with `REVOKE ALL ... FROM authenticated`
-- on the tables a hook reads — correct for a hook-dedicated table, but wrong
-- here: `profiles` and `organizations` are core tables the live dashboard
-- already depends on for every authenticated user via RLS. Only ADD the
-- grant this role is missing; never touch the existing authenticated grant.
GRANT SELECT ON public.profiles TO supabase_auth_admin;
GRANT SELECT ON public.organizations TO supabase_auth_admin;
