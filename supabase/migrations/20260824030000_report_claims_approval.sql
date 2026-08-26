-- Persist the claims/legal gate separately from final report approval. A report
-- cannot become an externally approved deliverable unless the claims review is
-- tied to the same evidence fingerprint as the saved report snapshot.

alter table public.commercialization_reports
  add column if not exists claims_approved_by uuid references public.profiles(id) on delete restrict,
  add column if not exists claims_approved_at timestamptz,
  add column if not exists claims_scope text,
  add column if not exists claims_evidence_fingerprint text;

alter table public.commercialization_reports
  drop constraint if exists commercialization_reports_claims_approval_complete,
  add constraint commercialization_reports_claims_approval_complete check (
    (
      claims_approved_by is null
      and claims_approved_at is null
      and claims_scope is null
      and claims_evidence_fingerprint is null
    )
    or (
      claims_approved_by is not null
      and claims_approved_at is not null
      and length(trim(claims_scope)) >= 10
      and length(trim(claims_evidence_fingerprint)) > 0
    )
  );

create or replace function public.validate_report_release_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  snapshot_fingerprint text;
begin
  snapshot_fingerprint := coalesce(new.report_snapshot #>> '{decision,fingerprint}', '');

  if new.claims_approved_by is distinct from old.claims_approved_by
    or new.claims_approved_at is distinct from old.claims_approved_at
    or new.claims_scope is distinct from old.claims_scope
    or new.claims_evidence_fingerprint is distinct from old.claims_evidence_fingerprint then
    if not public.is_admin() then
      raise exception 'Only an active administrator can record or revoke claims approval';
    end if;
    if new.claims_approved_by is not null and new.claims_approved_by is distinct from auth.uid() then
      raise exception 'Claims approval must be attributed to the current administrator';
    end if;
  end if;

  if new.status = 'approved' then
    if new.claims_approved_by is null or new.claims_approved_at is null then
      raise exception 'Claims/legal approval is required before external report approval';
    end if;
    if snapshot_fingerprint = '' or new.claims_evidence_fingerprint is distinct from snapshot_fingerprint then
      raise exception 'Claims/legal approval does not match the report evidence fingerprint';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_report_release_approval on public.commercialization_reports;
create trigger validate_report_release_approval
  before update on public.commercialization_reports
  for each row execute function public.validate_report_release_approval();

create or replace function public.approve_report_claims(
  target_report_id uuid,
  target_scope text,
  target_evidence_fingerprint text
)
returns public.commercialization_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_report public.commercialization_reports;
begin
  if not public.is_admin() then
    raise exception 'Only an active administrator can approve claims';
  end if;
  if length(trim(coalesce(target_scope, ''))) < 10 then
    raise exception 'Describe the scope of the claims/legal review';
  end if;
  if length(trim(coalesce(target_evidence_fingerprint, ''))) = 0 then
    raise exception 'An evidence fingerprint is required';
  end if;

  update public.commercialization_reports
  set
    claims_approved_by = auth.uid(),
    claims_approved_at = now(),
    claims_scope = trim(target_scope),
    claims_evidence_fingerprint = trim(target_evidence_fingerprint),
    updated_at = now()
  where id = target_report_id
    and org_id = public.current_org_id()
    and status in ('draft', 'review')
    and coalesce(report_snapshot #>> '{decision,fingerprint}', '') = trim(target_evidence_fingerprint)
  returning * into updated_report;

  if updated_report.id is null then
    raise exception 'Report not found, locked, or evidence fingerprint changed';
  end if;
  return updated_report;
end;
$$;

create or replace function public.revoke_report_claims(target_report_id uuid)
returns public.commercialization_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_report public.commercialization_reports;
begin
  if not public.is_admin() then
    raise exception 'Only an active administrator can revoke claims approval';
  end if;

  update public.commercialization_reports
  set
    claims_approved_by = null,
    claims_approved_at = null,
    claims_scope = null,
    claims_evidence_fingerprint = null,
    updated_at = now()
  where id = target_report_id
    and org_id = public.current_org_id()
    and status <> 'approved'
  returning * into updated_report;

  if updated_report.id is null then
    raise exception 'Report not found or final approval must be reopened first';
  end if;
  return updated_report;
end;
$$;

revoke all on function public.approve_report_claims(uuid, text, text) from public;
revoke all on function public.revoke_report_claims(uuid) from public;
grant execute on function public.approve_report_claims(uuid, text, text) to authenticated;
grant execute on function public.revoke_report_claims(uuid) to authenticated;

comment on column public.commercialization_reports.claims_scope is
  'Human-entered scope of the claims/legal review for this immutable report version.';
comment on column public.commercialization_reports.claims_evidence_fingerprint is
  'Decision evidence fingerprint reviewed by claims/legal; must match the report snapshot for final approval.';
