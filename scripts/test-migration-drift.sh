#!/usr/bin/env bash
#
# Fixture tests for scripts/check-migration-drift.sh. These avoid live Supabase
# access and lock the parser behavior used by CI.
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_SCRIPT="$ROOT_DIR/scripts/check-migration-drift.sh"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

run_case() {
  local name="$1"
  local expected_status="$2"
  local fixture="$3"
  local file="$TMP_DIR/$name.txt"

  printf '%s\n' "$fixture" > "$file"

  set +e
  CHECK_MIGRATION_DRIFT_FIXTURE="$file" bash "$CHECK_SCRIPT" > "$TMP_DIR/$name.out" 2>&1
  local actual_status=$?
  set -e

  if [ "$actual_status" -ne "$expected_status" ]; then
    echo "Migration drift fixture failed: $name"
    echo "Expected status: $expected_status"
    echo "Actual status: $actual_status"
    cat "$TMP_DIR/$name.out"
    exit 1
  fi
}

run_case "no-remote-only" 0 '
        LOCAL      |     REMOTE     |        TIME
  20260602000000   | 20260602000000 | 2026-06-02 00:00:00
  20260603000000   | 20260603000000 | 2026-06-03 00:00:00
'

run_case "remote-only-fails" 1 '
        LOCAL      |     REMOTE     |        TIME
                   | 20260625000000 | 2026-06-25 00:00:00
  20260602000000   | 20260602000000 | 2026-06-02 00:00:00
'

run_case "local-only-allowed" 0 '
        LOCAL      |     REMOTE     |        TIME
  20260602000000   | 20260602000000 | 2026-06-02 00:00:00
  20260626000000   |                | 2026-06-26 00:00:00
'

run_api_case() {
  local name="$1"
  local expected_status="$2"
  local fixture="$3"
  local file="$TMP_DIR/$name.json"

  printf '%s\n' "$fixture" > "$file"

  set +e
  CHECK_MIGRATION_DRIFT_API_FIXTURE="$file" bash "$CHECK_SCRIPT" > "$TMP_DIR/$name.out" 2>&1
  local actual_status=$?
  set -e

  if [ "$actual_status" -ne "$expected_status" ]; then
    echo "Migration drift API fixture failed: $name"
    echo "Expected status: $expected_status"
    echo "Actual status: $actual_status"
    cat "$TMP_DIR/$name.out"
    exit 1
  fi
}

run_api_case "api-no-remote-only" 0 '[
  {"version":"20260602000000","name":"initial_schema"},
  {"version":"20260603000000","name":"add_missing_response_columns"}
]'

run_api_case "api-remote-only-fails" 1 '[
  {"version":"20260602000000","name":"initial_schema"},
  {"version":"20990101000000","name":"missing_from_repository"}
]'

run_api_case "api-invalid-response-fails" 1 '{"message":"permission denied"}'

echo "OK - migration drift parser fixtures passed."
