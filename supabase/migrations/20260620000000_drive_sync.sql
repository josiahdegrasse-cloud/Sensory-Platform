-- ════════════════════════════════════════════════════════════════════════════
-- Google Drive sync — service-account import source
-- ════════════════════════════════════════════════════════════════════════════
-- Admins connect a shared Drive folder (per org) and pull CSVs into the import
-- queue. The drive-sync Edge Function authenticates as a Google service account
-- (server-side, no user OAuth), downloads selected files, and hands them to the
-- existing process-import pipeline. These columns are additive only.
--
--   workspace_settings.drive_folder_id   — folder the org has connected
--   workspace_settings.drive_folder_name — display label for the UI
--   pending_imports.source               — 'upload' | 'google_drive'
--   pending_imports.source_file_id       — Drive file id, used for dedup
--
-- The existing upsert_workspace_settings RPC uses jsonb_populate_record, so the
-- new settings columns flow through automatically once they exist (same pattern
-- as the report-branding migration). No RLS changes are required: the existing
-- workspace_settings and pending_imports policies already cover these columns.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS drive_folder_id text,
  ADD COLUMN IF NOT EXISTS drive_folder_name text;

ALTER TABLE public.pending_imports
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'upload'
    CONSTRAINT pending_imports_source_values
      CHECK (source IN ('upload', 'google_drive')),
  ADD COLUMN IF NOT EXISTS source_file_id text;

-- Dedup lookup: "has this Drive file already been queued for this org?"
CREATE INDEX IF NOT EXISTS idx_pending_imports_source_file
  ON public.pending_imports(org_id, source_file_id);
