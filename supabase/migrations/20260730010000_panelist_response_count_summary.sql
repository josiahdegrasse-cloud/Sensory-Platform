-- Avoid transferring one row per sensory response merely to show each
-- panelist's completion count in the administration workspace.
create or replace function public.get_response_counts_by_panelist()
returns table (
  user_id uuid,
  response_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    response.user_id,
    count(*)::bigint as response_count
  from public.responses as response
  group by response.user_id;
$$;

revoke all on function public.get_response_counts_by_panelist() from public;
grant execute on function public.get_response_counts_by_panelist() to authenticated;

comment on function public.get_response_counts_by_panelist() is
  'Tenant-scoped response completion counts for the panelist administration workspace.';
