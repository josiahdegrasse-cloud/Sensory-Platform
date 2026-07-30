-- Lightweight counts for concept-test dashboards and project workflow status.
create or replace function public.get_concept_response_counts()
returns table (
  concept_test_id uuid,
  response_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    response.concept_test_id,
    count(*)::bigint as response_count
  from public.concept_responses as response
  group by response.concept_test_id;
$$;

revoke all on function public.get_concept_response_counts() from public;
grant execute on function public.get_concept_response_counts() to authenticated;

comment on function public.get_concept_response_counts() is
  'Tenant-scoped concept response counts for dashboards and workflow summaries.';
