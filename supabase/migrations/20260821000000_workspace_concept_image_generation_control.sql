alter table public.workspace_settings
  add column if not exists concept_image_generation_enabled boolean not null default true;

comment on column public.workspace_settings.concept_image_generation_enabled is
  'Workspace-level kill switch for all AI concept image generation. Enforced by the generate-concept-images Edge Function.';
