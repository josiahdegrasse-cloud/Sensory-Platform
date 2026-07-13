-- ════════════════════════════════════════════════════════════════════════════
-- RAG service schema (Food RAG systme)
-- ════════════════════════════════════════════════════════════════════════════
-- Adds storage for the separate NFI Food Intelligence RAG service into this
-- same Supabase project, so it can reuse existing org/auth infrastructure
-- instead of standing up its own Postgres instance.
--
-- Design choices (deliberate):
--   1. Every new table is prefixed `rag_` so nothing here can ever collide
--      with an existing table — notably, this project already has its own
--      `public.audit_events` for dashboard actions; the RAG service's own
--      audit log is `rag_audit_events`, a distinct table.
--   2. The RAG service's Python code identifies tenants by a `tenant_id`
--      TEXT string (validated by a `^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$`
--      regex in rag_food/tenant.py), not a uuid. Rather than change that
--      code, tenant_id here is the org's existing `slug` column (already
--      unique, already text, already fits that pattern — e.g. 'nfi').
--      current_org_slug() below bridges current_org_id() to that string so
--      RLS policies can compare directly against tenant_id.
--   3. Access pattern: the RAG service's FastAPI backend connects with a
--      direct Postgres connection string (psycopg) and already enforces
--      tenant scoping in every query (see postgres_store.py/jobs.py/
--      sessions.py/audit.py — every method takes an explicit tenant_id
--      parameter). RLS here is a defense-in-depth backstop matching this
--      project's existing convention of enabling it on every table, not
--      the primary enforcement mechanism for that backend's own queries.
--   4. Embeddings default to 384 dimensions (sentence-transformers
--      all-MiniLM-L6-v2, run locally by the RAG service) rather than
--      OpenAI's 1536, so retrieval has zero per-query API cost.
--   5. Policies below are plain (permissive) policies, not `AS RESTRICTIVE`
--      like this project's dashboard-table tenant-isolation policies.
--      RESTRICTIVE only narrows an existing PERMISSIVE grant — the
--      dashboard's tenant_tables already had role/ownership permissive
--      policies from earlier migrations for it to layer onto. These are
--      brand-new tables with no other policy, so a lone RESTRICTIVE policy
--      would deny every row unconditionally (verified locally: it did,
--      before this was corrected — see PR notes / local test log).
--
-- SAFETY: Verified locally against a native Postgres instance (schema, RLS
-- behavior for admin/panelist/no-profile cases, and cross-tenant isolation
-- all confirmed correct) before ever touching a hosted Supabase project.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 0. Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ─── 1. Tenant bridge: org slug is the RAG service's tenant_id ───────────────
CREATE OR REPLACE FUNCTION public.current_org_slug()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT slug FROM public.organizations WHERE id = public.current_org_id()
$$;

REVOKE ALL ON FUNCTION public.current_org_slug() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_org_slug() TO authenticated;

-- ─── 2. rag_chunks: retrieval corpus (mirrors rag_food/postgres_store.py) ────
CREATE TABLE IF NOT EXISTS public.rag_chunks (
  tenant_id text NOT NULL REFERENCES public.organizations(slug) ON DELETE RESTRICT,
  chunk_id text NOT NULL,
  source_path text NOT NULL,
  title text NOT NULL,
  page_start integer NOT NULL,
  page_end integer NOT NULL,
  chunk_index integer NOT NULL,
  section text NOT NULL,
  document_id text NOT NULL,
  library_id text NOT NULL,
  topic_tags text NOT NULL DEFAULT '',
  method_tags text NOT NULL DEFAULT '',
  evidence_type text NOT NULL DEFAULT '',
  text text NOT NULL,
  embedding vector(384) NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(text, ''))
  ) STORED,
  PRIMARY KEY (tenant_id, chunk_id)
);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_tenant_source ON public.rag_chunks(tenant_id, source_path);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_search ON public.rag_chunks USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_rag_chunks_embedding_hnsw
  ON public.rag_chunks USING hnsw (embedding vector_cosine_ops);

ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.rag_chunks;
CREATE POLICY org_isolation ON public.rag_chunks
  FOR ALL TO authenticated
  USING (tenant_id = public.current_org_slug())
  WITH CHECK (tenant_id = public.current_org_slug());

-- ─── 3. rag_jobs: durable background job queue (mirrors rag_food/jobs.py) ───
CREATE TABLE IF NOT EXISTS public.rag_jobs (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES public.organizations(slug) ON DELETE RESTRICT,
  kind text NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL,
  started_at text,
  finished_at text,
  result_json text,
  error text,
  payload_json text NOT NULL DEFAULT '{}',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  worker_id text,
  heartbeat_at text,
  cancel_requested boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_rag_jobs_tenant_created ON public.rag_jobs(tenant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rag_jobs_one_running_per_tenant
  ON public.rag_jobs(tenant_id) WHERE status = 'running';

ALTER TABLE public.rag_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation ON public.rag_jobs;
CREATE POLICY org_isolation ON public.rag_jobs
  FOR ALL TO authenticated
  USING (tenant_id = public.current_org_slug())
  WITH CHECK (tenant_id = public.current_org_slug());

-- ─── 4. rag_auth_sessions / rag_auth_login_states ────────────────────────────
-- The RAG service's own relying-party session store (mirrors
-- rag_food/sessions.py). Supabase Auth issues the JWT after login; these
-- tables let the RAG backend remember "this browser already completed
-- login" via a fast session-id lookup instead of re-validating a JWT on
-- every request. Not tenant-scoped by RLS — a session row's payload_json
-- carries its own tenantId/role, checked by the application itself.
CREATE TABLE IF NOT EXISTS public.rag_auth_login_states (
  state text PRIMARY KEY,
  payload_json text NOT NULL,
  expires_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.rag_auth_sessions (
  session_id text PRIMARY KEY,
  payload_json text NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rag_auth_sessions_expires ON public.rag_auth_sessions(expires_at);

ALTER TABLE public.rag_auth_login_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_auth_sessions ENABLE ROW LEVEL SECURITY;
-- No authenticated-role policy: these are written and read exclusively by
-- the RAG service's own backend connection, never by a browser Supabase
-- client. RLS enabled with no permissive policy means "deny all" for the
-- authenticated/anon roles, which is the correct default here.

-- ─── 5. rag_audit_events: RAG service's own audit log ────────────────────────
-- Deliberately separate from this project's existing public.audit_events
-- (dashboard actions) — different shape, different subject matter, and
-- collapsing them would mean the RAG service can write dashboard audit rows
-- (or vice versa) with no code change to catch it.
CREATE TABLE IF NOT EXISTS public.rag_audit_events (
  id text PRIMARY KEY,
  occurred_at timestamptz NOT NULL,
  tenant_id text NOT NULL REFERENCES public.organizations(slug) ON DELETE RESTRICT,
  subject text NOT NULL,
  role text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id text NOT NULL,
  outcome text NOT NULL,
  request_id text NOT NULL,
  details_json jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_rag_audit_events_tenant_time
  ON public.rag_audit_events(tenant_id, occurred_at DESC);

ALTER TABLE public.rag_audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_isolation_select ON public.rag_audit_events;
CREATE POLICY org_isolation_select ON public.rag_audit_events
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_org_slug());
-- Insert-only from the RAG backend's own connection; no authenticated-role
-- insert policy, so a browser client can read its own org's audit trail
-- (if ever exposed) but can never write or forge an entry.
