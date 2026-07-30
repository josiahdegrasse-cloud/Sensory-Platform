-- Return the small response-count projection needed by project workflow
-- summaries. SECURITY INVOKER intentionally keeps the caller's responses RLS
-- policy in force, so each tenant sees only its own aggregate.
create or replace function public.get_response_counts_by_product()
returns table (
  product_id uuid,
  response_count bigint
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    response.product_id,
    count(*)::bigint as response_count
  from public.responses as response
  group by response.product_id;
$$;

revoke all on function public.get_response_counts_by_product() from public;
grant execute on function public.get_response_counts_by_product() to authenticated;

comment on function public.get_response_counts_by_product() is
  'Tenant-scoped response counts for lightweight project workflow summaries.';
