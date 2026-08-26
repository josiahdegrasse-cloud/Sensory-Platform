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
# In CI, SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF are used to read migration
# history through the Supabase Management API. This deliberately avoids creating
# a temporary database login role or granting the CI token database write access.
# Local use without those variables falls back to `supabase migration list`.
#
# Testing the parser without a network call:
#   CHECK_MIGRATION_DRIFT_FIXTURE=/path/to/sample-migration-list.txt \
#     bash scripts/check-migration-drift.sh
# The fixture should be raw `supabase migration list --linked` output.
#
set -euo pipefail

echo "Checking that the production schema is not ahead of this branch..."

if [ -n "${CHECK_MIGRATION_DRIFT_FIXTURE:-}" ]; then
  # Fixture and local-fallback output is a "Local | Remote | Time" table. A row
  # with an empty Local column and a 14-digit Remote version is remote-only.
  remote_only="$(
    awk -F'|' '
      NF >= 2 {
        local = $1; remote = $2;
        gsub(/[^0-9]/, "", local);
        gsub(/[^0-9]/, "", remote);
        if (remote ~ /^[0-9]{14}$/ && local == "") print remote;
      }
    ' "$CHECK_MIGRATION_DRIFT_FIXTURE"
  )"
elif [ -n "${CHECK_MIGRATION_DRIFT_API_FIXTURE:-}" ] || {
  [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && [ -n "${SUPABASE_PROJECT_REF:-}" ]
}; then
  tmp_dir="$(mktemp -d)"
  trap 'rm -rf "$tmp_dir"' EXIT

  if [ -n "${CHECK_MIGRATION_DRIFT_API_FIXTURE:-}" ]; then
    cp "$CHECK_MIGRATION_DRIFT_API_FIXTURE" "$tmp_dir/remote.json"
  else
    curl --fail-with-body --silent --show-error \
      --retry 3 --retry-all-errors \
      --header "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
      "https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/migrations" \
      --output "$tmp_dir/remote.json"
  fi

  if ! jq --exit-status '
    type == "array" and
    all(.[]; (.version | tostring | test("^[0-9]{14}$")))
  ' "$tmp_dir/remote.json" >/dev/null; then
    echo "::error::Supabase returned an invalid migration-history response."
    exit 1
  fi

  jq --raw-output '.[].version | tostring' "$tmp_dir/remote.json" \
    | sort -u > "$tmp_dir/remote.txt"
  find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print \
    | sed -E 's#.*/([0-9]{14})_.*#\1#' \
    | sort -u > "$tmp_dir/local.txt"

  remote_only="$(comm -23 "$tmp_dir/remote.txt" "$tmp_dir/local.txt")"
else
  remote_only="$(
    supabase migration list --linked \
      | awk -F'|' '
          NF >= 2 {
            local = $1; remote = $2;
            gsub(/[^0-9]/, "", local);
            gsub(/[^0-9]/, "", remote);
            if (remote ~ /^[0-9]{14}$/ && local == "") print remote;
          }
        '
  )"
fi

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
