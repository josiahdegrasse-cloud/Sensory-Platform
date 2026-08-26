-- Give every questionnaire submission a durable session identity. Multi-sample
-- rows from one submit share a session; repeat runs remain separate sessions
-- and no longer inflate the workflow's independent-participant count.

alter table public.responses
  add column if not exists response_session_id uuid,
  add column if not exists sample_ordinal integer;

with legacy_sessions as (
  select
    user_id,
    product_id,
    created_at,
    gen_random_uuid() as session_id
  from public.responses
  group by user_id, product_id, created_at
)
update public.responses as response
set response_session_id = legacy.session_id
from legacy_sessions as legacy
where response.response_session_id is null
  and response.user_id = legacy.user_id
  and response.product_id = legacy.product_id
  and response.created_at is not distinct from legacy.created_at;

with ordered_rows as (
  select
    id,
    row_number() over (
      partition by response_session_id
      order by run_number, created_at, id
    )::integer as ordinal
  from public.responses
)
update public.responses as response
set sample_ordinal = ordered.ordinal
from ordered_rows as ordered
where response.id = ordered.id
  and response.sample_ordinal is null;

alter table public.responses
  alter column response_session_id set default gen_random_uuid(),
  alter column response_session_id set not null,
  alter column sample_ordinal set default 1,
  alter column sample_ordinal set not null;

alter table public.responses
  drop constraint if exists responses_sample_ordinal_positive,
  add constraint responses_sample_ordinal_positive check (sample_ordinal > 0),
  drop constraint if exists responses_session_sample_unique,
  add constraint responses_session_sample_unique unique (response_session_id, sample_ordinal);

create index if not exists idx_responses_product_session
  on public.responses (product_id, response_session_id);

create index if not exists idx_responses_product_user
  on public.responses (product_id, user_id);

comment on column public.responses.response_session_id is
  'One questionnaire submission. Multi-sample response rows from the same submission share this id.';
comment on column public.responses.sample_ordinal is
  'One-based sample position within a questionnaire submission.';

-- Workflow readiness is a participant count, not a row or repeat-run count.
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
    count(distinct response.user_id)::bigint as response_count
  from public.responses as response
  group by response.product_id;
$$;

revoke all on function public.get_response_counts_by_product() from public;
grant execute on function public.get_response_counts_by_product() to authenticated;

comment on function public.get_response_counts_by_product() is
  'Tenant-scoped independent-participant counts for workflow readiness. Repeat sessions and multi-sample rows do not inflate n.';
