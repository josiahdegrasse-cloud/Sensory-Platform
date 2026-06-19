-- ════════════════════════════════════════════════════════════════════════════
-- Pending Imports — monitored drop-zone for instrument CSV exports
-- ════════════════════════════════════════════════════════════════════════════
-- Analysts (or a future SFTP bridge) upload CSVs to the instrument-imports
-- bucket. The process-import Edge Function parses each file and writes a row
-- here with status matched | ambiguous | failed. Admins review the queue and
-- confirm or dismiss each import from the Machine Testing page.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Storage bucket ───────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'instrument-imports',
  'instrument-imports',
  false,
  5242880,
  ARRAY['text/csv', 'text/plain', 'application/csv', 'application/octet-stream']
)
ON CONFLICT (id) DO NOTHING;

-- Files are stored under {user_id}/{timestamp}_{filename}. RLS ties access to
-- auth.uid() so service-role operations in the Edge Function still work.
DROP POLICY IF EXISTS instrument_imports_insert ON storage.objects;
CREATE POLICY instrument_imports_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'instrument-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS instrument_imports_select ON storage.objects;
CREATE POLICY instrument_imports_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'instrument-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS instrument_imports_delete ON storage.objects;
CREATE POLICY instrument_imports_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'instrument-imports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── 2. pending_imports ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pending_imports (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  storage_path    text        NOT NULL,
  file_name       text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending'
    CONSTRAINT pending_imports_status_values
      CHECK (status IN ('pending', 'matched', 'ambiguous', 'failed', 'imported', 'dismissed')),
  matched_batch_id uuid       REFERENCES public.import_batches(id) ON DELETE SET NULL,
  -- parse_preview: { headers, recognized, ignored, rowCount, sampleRows }
  parse_preview   jsonb,
  error_message   text,
  uploaded_by     uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_imports_org_status
  ON public.pending_imports(org_id, status, created_at DESC);

ALTER TABLE public.pending_imports ENABLE ROW LEVEL SECURITY;

-- Stamp org_id from the calling user on every insert
DROP TRIGGER IF EXISTS trg_pending_imports_set_org_id ON public.pending_imports;
CREATE TRIGGER trg_pending_imports_set_org_id
  BEFORE INSERT ON public.pending_imports
  FOR EACH ROW EXECUTE FUNCTION public.set_org_id();

-- All org members can see the queue; any authenticated member can insert/update
-- (the trigger enforces org isolation)
DROP POLICY IF EXISTS pending_imports_select ON public.pending_imports;
CREATE POLICY pending_imports_select ON public.pending_imports
  FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS pending_imports_insert ON public.pending_imports;
CREATE POLICY pending_imports_insert ON public.pending_imports
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id());

DROP POLICY IF EXISTS pending_imports_update ON public.pending_imports;
CREATE POLICY pending_imports_update ON public.pending_imports
  FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());
