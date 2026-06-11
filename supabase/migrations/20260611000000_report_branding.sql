-- Report branding: per-tenant report voice and default title template.
-- The client already sends these keys via upsert_workspace_settings(patch);
-- jsonb_populate_record ignored them until these columns exist.

ALTER TABLE public.workspace_settings
  ADD COLUMN IF NOT EXISTS report_tone text
    CHECK (report_tone IN ('formal', 'standard', 'energetic')),
  ADD COLUMN IF NOT EXISTS default_report_title text;
