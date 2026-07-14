-- Dedicated login role for the deployed Food RAG backend.
--
-- The password is deliberately not stored in source control. Deployment
-- automation provisions it separately and stores it only as a host secret.
-- BYPASSRLS is required because the backend connects directly to Postgres;
-- its blast radius is constrained by the narrow table grants below, while
-- every application query still includes an explicit tenant_id predicate.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rag_service') THEN
    CREATE ROLE rag_service
      LOGIN
      NOINHERIT
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      BYPASSRLS
      CONNECTION LIMIT 20;
  ELSE
    ALTER ROLE rag_service
      LOGIN
      NOINHERIT
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      BYPASSRLS
      CONNECTION LIMIT 20;
  END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO rag_service;
GRANT USAGE ON SCHEMA public TO rag_service;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM rag_service;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM rag_service;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM rag_service;

GRANT SELECT ON TABLE
  public.organizations,
  public.projects,
  public.food_types,
  public.decision_records,
  public.rag_index_config
TO rag_service;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.rag_chunks,
  public.rag_jobs,
  public.rag_auth_login_states,
  public.rag_auth_sessions
TO rag_service;

GRANT SELECT, INSERT ON TABLE public.rag_audit_events TO rag_service;

ALTER ROLE rag_service SET statement_timeout = '120s';
ALTER ROLE rag_service SET lock_timeout = '10s';
ALTER ROLE rag_service SET idle_in_transaction_session_timeout = '60s';

COMMENT ON ROLE rag_service IS
  'Least-privilege direct Postgres login for the deployed Food RAG backend; password is provisioned outside migrations.';
