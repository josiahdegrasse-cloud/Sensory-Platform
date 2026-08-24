alter table public.workspace_settings
  add column if not exists demo_mode_enabled boolean not null default false;

update public.workspace_settings as settings
set
  demo_mode_enabled = true,
  concept_image_generation_enabled = false
from public.organizations as organization
where organization.id = settings.org_id
  and organization.slug = 'sensory-demo';

create or replace function public.enforce_demo_workspace_safeguards()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.organizations
    where id = new.org_id
      and slug = 'sensory-demo'
  ) then
    new.demo_mode_enabled := true;
    new.concept_image_generation_enabled := false;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_enforce_demo_workspace_safeguards on public.workspace_settings;
create trigger zz_enforce_demo_workspace_safeguards
  before insert or update on public.workspace_settings
  for each row execute function public.enforce_demo_workspace_safeguards();

comment on column public.workspace_settings.demo_mode_enabled is
  'Server-controlled marker for the isolated public demo tenant. Demo safeguards cannot be disabled through workspace settings.';

comment on function public.enforce_demo_workspace_safeguards() is
  'Keeps the public demo marker enabled and paid concept-image generation disabled for the sensory-demo organization.';
