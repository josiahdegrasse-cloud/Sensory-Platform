-- Align the shared Supabase RAG schema with the deployed Food RAG service.
--
-- Schema ownership stays here: the Python service verifies this contract at
-- startup but must never create or alter these tables itself.

BEGIN;

CREATE TABLE IF NOT EXISTS public.rag_index_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO public.rag_index_config (key, value)
VALUES ('embedding_dimensions', '384')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.rag_chunks
  ADD COLUMN IF NOT EXISTS parent_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS parent_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS heading text NOT NULL DEFAULT '';

-- The dashboard never reads or mutates retrieval storage directly. All access
-- goes through the authenticated RAG backend, whose direct database role is
-- tenant-scoped in every query. Removing browser policies prevents a valid
-- Supabase access token from inserting, rewriting, or deleting corpus/job rows.
DROP POLICY IF EXISTS org_isolation ON public.rag_chunks;
DROP POLICY IF EXISTS org_isolation ON public.rag_jobs;

ALTER TABLE public.rag_index_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rag_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.rag_index_config FROM anon, authenticated;
REVOKE ALL ON TABLE public.rag_chunks FROM anon, authenticated;
REVOKE ALL ON TABLE public.rag_jobs FROM anon, authenticated;

COMMENT ON TABLE public.rag_index_config IS
  'Backend-owned RAG index contract. Managed only by Supabase migrations.';
COMMENT ON COLUMN public.rag_chunks.parent_id IS
  'Optional parent chunk identifier for parent-child retrieval.';
COMMENT ON COLUMN public.rag_chunks.parent_text IS
  'Optional parent context retained for hierarchical retrieval.';
COMMENT ON COLUMN public.rag_chunks.heading IS
  'Source heading associated with this retrieval chunk.';

COMMIT;
