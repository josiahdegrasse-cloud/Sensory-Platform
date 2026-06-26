#!/usr/bin/env bash
#
# Guard 1 — schema-vs-code ordering check.
#
# Fails if any migration is APPLIED on the linked Supabase project but is MISSING
# from this branch's supabase/migrations/. That specific condition — prod schema
# AHEAD of the code in the branch — is the shape of the 2026-06-25 outage (column
# renames reached prod before the app code that expected them).
#
# The reverse (local migrations not yet applied to prod) is the normal pre-deploy
# state and is intentionally allowed.
#
# Requires:
#   - supabase CLI on PATH, linked to the project (CI does `supabase link` first)
#   - SUPABASE_ACCESS_TOKEN in the environment (Management API auth)
#
# Testing the parser without a network call:
#   CHECK_MIGRATION_DRIFT_FIXTURE=/path/to/sample-migration-list.txt \
#     bash scripts/check-migration-drift.sh
# The fixture should be raw `supabase migration list --linked` output.
#
set -euo pipefail

list_output() {
  if [ -n "${CHECK_MIGRATION_DRIFT_FIXTURE:-}" ]; then
    cat "$CHECK_MIGRATION_DRIFT_FIXTURE"
  else
    supabase migration list --linked
  fi
}

echo "Checking that the linked project's schema is not ahead of this branch..."

# `supabase migration list` prints a "Local | Remote | Time" table. A row with an
# empty Local column but a 14-digit Remote version = applied on the remote DB but
# absent from this branch's supabase/migrations/.
remote_only="$(
  list_output \
    | awk -F'|' '
        NF >= 2 {
          local = $1; remote = $2;
          gsub(/[^0-9]/, "", local);
          gsub(/[^0-9]/, "", remote);
          if (remote ~ /^[0-9]{14}$/ && local == "") print remote;
        }
      '
)"

if [ -n "$remote_only" ]; then
  echo "::error::Schema drift: migrations applied on the linked Supabase project are"
  echo "::error::missing from this branch (prod schema is AHEAD of this code):"
  while IFS= read -r v; do
    [ -n "$v" ] && echo "  - $v"
  done <<< "$remote_only"
  echo ""
  echo "This is the 2026-06-25 outage shape. Bring the missing migration file into"
  echo "this branch (or revert the remote change) before merging."
  exit 1
fi

echo "OK — no remote-only migrations. Prod schema is not ahead of this branch."
