-- Make the approved commercialization-readiness design the workspace default.
ALTER TABLE public.workspace_settings
  ALTER COLUMN report_template SET DEFAULT 'editorial-sage';

UPDATE public.workspace_settings
SET report_template = 'editorial-sage'
WHERE report_template IS NULL OR report_template = 'standard';
