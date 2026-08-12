-- Durable publication upload and ingestion queue. Files live in private
-- Supabase Storage; the research service receives only short-lived signed URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('literature-imports', 'literature-imports', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf'];

CREATE TABLE public.literature_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES public.organizations(slug) ON DELETE RESTRICT,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  sha256 text NOT NULL,
  file_size bigint NOT NULL CHECK (file_size > 0 AND file_size <= 52428800),
  status text NOT NULL DEFAULT 'uploaded'
    CHECK (status IN ('uploaded', 'processing', 'indexed', 'duplicate', 'failed')),
  document_id text,
  title text,
  authors text,
  publication_year text,
  doi text,
  page_count integer,
  text_quality text,
  evidence_type text,
  source_quality_score integer CHECK (source_quality_score BETWEEN 0 AND 100),
  source_quality_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  duplicate_of text,
  error_message text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, sha256)
);

CREATE INDEX literature_imports_queue_idx
  ON public.literature_imports (tenant_id, status, created_at DESC);

ALTER TABLE public.literature_imports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.prepare_literature_import()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.org_id := public.current_org_id();
  SELECT slug INTO NEW.tenant_id FROM public.organizations WHERE id = NEW.org_id;
  NEW.uploaded_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER literature_imports_prepare
  BEFORE INSERT ON public.literature_imports
  FOR EACH ROW EXECUTE FUNCTION public.prepare_literature_import();

CREATE OR REPLACE FUNCTION public.touch_literature_import()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

CREATE TRIGGER literature_imports_touch
  BEFORE UPDATE ON public.literature_imports
  FOR EACH ROW EXECUTE FUNCTION public.touch_literature_import();

CREATE POLICY literature_imports_select ON public.literature_imports
  FOR SELECT TO authenticated USING (org_id = public.current_org_id() AND public.is_admin());
CREATE POLICY literature_imports_insert ON public.literature_imports
  FOR INSERT TO authenticated WITH CHECK (org_id = public.current_org_id() AND public.is_admin());
CREATE POLICY literature_imports_update ON public.literature_imports
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin())
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin());

CREATE POLICY literature_imports_storage_insert ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'literature-imports'
    AND (storage.foldername(name))[1] = public.current_org_slug()
    AND public.is_admin()
  );
CREATE POLICY literature_imports_storage_select ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'literature-imports'
    AND (storage.foldername(name))[1] = public.current_org_slug()
    AND public.is_admin()
  );
CREATE POLICY literature_imports_storage_delete ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'literature-imports'
    AND (storage.foldername(name))[1] = public.current_org_slug()
    AND public.is_admin()
  );

REVOKE ALL ON public.literature_imports FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.literature_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.literature_imports TO rag_service;

CREATE OR REPLACE FUNCTION public.create_literature_import(
  target_file_name text,
  target_sha256 text,
  target_file_size bigint
)
RETURNS public.literature_imports
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  created public.literature_imports;
  safe_name text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only active administrators can upload literature';
  END IF;
  IF target_sha256 !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid SHA-256 digest';
  END IF;
  IF target_file_size <= 0 OR target_file_size > 52428800 THEN
    RAISE EXCEPTION 'Publication must be between 1 byte and 50 MB';
  END IF;
  safe_name := regexp_replace(target_file_name, '[^A-Za-z0-9._-]+', '_', 'g');
  IF lower(right(safe_name, 4)) <> '.pdf' THEN
    RAISE EXCEPTION 'Only PDF publications are supported';
  END IF;
  INSERT INTO public.literature_imports (
    org_id, tenant_id, storage_path, file_name, sha256, file_size
  ) VALUES (
    public.current_org_id(), public.current_org_slug(),
    public.current_org_slug() || '/pending/' || safe_name,
    safe_name, target_sha256, target_file_size
  )
  RETURNING * INTO created;
  UPDATE public.literature_imports
  SET storage_path = created.tenant_id || '/' || created.id::text || '/' || safe_name
  WHERE id = created.id
  RETURNING * INTO created;
  RETURN created;
END
$$;

REVOKE ALL ON FUNCTION public.create_literature_import(text, text, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_literature_import(text, text, bigint) TO authenticated;

COMMENT ON TABLE public.literature_imports IS
  'Tenant-scoped publication upload, duplicate detection, metadata QC, and durable ingest status.';
