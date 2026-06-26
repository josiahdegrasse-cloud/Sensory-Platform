#!/usr/bin/env bash
#
# Guard 2 — apply DB migrations BEFORE the production build, so schema and code
# ship together on a single trigger (merge to main -> Vercel production build),
# instead of a human applying `supabase db push` out-of-band. This is the direct
# fix for the 2026-06-25 outage root cause (migration reached prod before code).
#
# Ordering guarantee: migrations run first; only if they succeed does the app
# build run and the deployment get promoted. A failed migration fails the build,
# so a mismatched bundle is never served (fail-safe).
#
# DORMANT BY DEFAULT. It only touches the database when BOTH:
#   - Vercel is building a PRODUCTION deployment (VERCEL_ENV=production), and
#   - SUPABASE_ACCESS_TOKEN is present in the Vercel project environment.
# Preview/branch builds and local builds NEVER touch the linked (prod) database.
# Until vercel.json's buildCommand points here AND the env vars are set, this
# script is not invoked at all and behaves exactly like `pnpm run build`.
#
# To enable, see CONTRIBUTING.md ("Guard 2"). Do one WATCHED production deploy
# first to confirm the migration step authenticates and the build succeeds.
#
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-golkgpeqenyqrcyawjdt}"

if [ "${VERCEL_ENV:-}" = "production" ] && [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then
  echo "==> Production build: applying pending Supabase migrations before deploy"
  npx --yes supabase@2.90.0 link --project-ref "$PROJECT_REF"
  # Idempotent: only pending migrations are applied. If this fails (e.g. auth),
  # the build fails and nothing is deployed — schema and code never diverge.
  npx --yes supabase@2.90.0 db push --linked
  echo "==> Migrations applied. Proceeding to app build."
elif [ "${VERCEL_ENV:-}" = "production" ]; then
  echo "==> Production build, but SUPABASE_ACCESS_TOKEN is unset — SKIPPING migrations."
  echo "    Guard 2 is not yet enabled (see CONTRIBUTING.md). Building app only."
else
  echo "==> Non-production build (VERCEL_ENV='${VERCEL_ENV:-unset}') — database untouched."
fi

pnpm run build
