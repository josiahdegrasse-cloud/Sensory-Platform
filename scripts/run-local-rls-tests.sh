#!/usr/bin/env bash
set -euo pipefail

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required for the disposable Supabase RLS test stack." >&2
  exit 1
fi
if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required for the disposable RLS test stack." >&2
  exit 1
fi

cleanup() {
  supabase stop --no-backup >/dev/null 2>&1 || true
}
trap cleanup EXIT

# A clean throwaway database proves the full migration chain, not only the
# final policy definitions. Keep Auth, PostgREST, Storage, and Kong because the
# isolation test signs in real users through the public API.
supabase start -x realtime,imgproxy,studio,mailpit,edge-runtime,logflare,vector,supavisor,postgres-meta

# `supabase status` is trusted local CLI output containing disposable keys and
# preserves quoting for values that may contain shell-significant characters.
eval "$(supabase status -o env)"
export API_URL ANON_KEY SERVICE_ROLE_KEY

: "${API_URL:?Supabase local API URL was not reported}"
: "${ANON_KEY:?Supabase local anon key was not reported}"
: "${SERVICE_ROLE_KEY:?Supabase local service role key was not reported}"

REQUIRE_RLS_TEST_ENV=1 \
RLS_TEST_DB_URL="${API_URL}" \
RLS_TEST_ANON_KEY="${ANON_KEY}" \
RLS_TEST_SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY}" \
npx pnpm@10 exec vitest run src/app/lib/rls-isolation.test.ts
