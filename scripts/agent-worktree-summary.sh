#!/usr/bin/env bash
#
# Summarize a noisy multi-agent worktree into ownership lanes.
#
set -euo pipefail

declare -a lanes=(
  "assistant-context"
  "agent-tooling"
  "ci-schema-guards"
  "project-journey"
  "mock-demo-isolation"
  "survey-workflows"
  "reports-concepts"
  "db-hooks-domain"
  "other"
)

lane_for_path() {
  local path="$1"

  case "$path" in
    AGENTS.md|CLAUDE.md)
      echo "assistant-context" ;;
    .claude/*|.cursor/*|.codex/*|agentdb.rvf.lock|zen-agentic-engineer-config/*)
      echo "agent-tooling" ;;
    .github/workflows/ci.yml|scripts/check-migration-drift.sh|scripts/test-migration-drift.sh|scripts/agent-worktree-summary.sh|scripts/vercel-build.sh|package.json)
      echo "ci-schema-guards" ;;
    src/app/routes.tsx|src/app/components/project-*|src/app/components/legacy-workflow-route.tsx|src/app/lib/project-*|src/app/lib/project-journey-routes*)
      echo "project-journey" ;;
    src/app/data/*|src/app/data/demo/*)
      echo "mock-demo-isolation" ;;
    src/app/components/*questionnaire*|src/app/components/survey-*|src/app/components/multi-sample-*|src/app/components/panelist-*|src/app/lib/use-survey-data.ts|src/app/utils/panelist-metrics*)
      echo "survey-workflows" ;;
    src/app/components/concept-*|src/app/components/commercialization-*|src/app/components/report-*|src/app/lib/report-*|src/app/utils/commercialization-*)
      echo "reports-concepts" ;;
    src/app/lib/db/*|src/app/lib/hooks.ts|src/app/lib/studies*|src/app/lib/workflow*|src/app/lib/insights.ts|src/app/lib/workflow/*|src/app/contexts/*)
      echo "db-hooks-domain" ;;
    *)
      echo "other" ;;
  esac
}

quote_path() {
  printf "'%s'" "${1//\'/\'\\\'\'}"
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

count_file() {
  local lane="$1"
  local file="$tmp_dir/$lane"
  if [ -f "$file" ]; then
    wc -l < "$file" | tr -d ' '
  else
    echo 0
  fi
}

while IFS= read -r line; do
  [ -n "$line" ] || continue
  status="${line:0:2}"
  path="${line:3}"
  # For rename/copy porcelain output, own the destination path.
  if [[ "$path" == *" -> "* ]]; then
    path="${path##* -> }"
  fi
  lane="$(lane_for_path "$path")"
  printf '%s %s\n' "$status" "$path" >> "$tmp_dir/$lane"
done < <(git status --short)

echo "# Agent Worktree Summary"
echo
echo "Use this to claim lanes and stage explicit files. Avoid \`git add .\`."
echo

for lane in "${lanes[@]}"; do
  count="$(count_file "$lane")"
  [ "$count" -gt 0 ] || continue

  echo "## $lane ($count)"
  sed 's/^/- /' "$tmp_dir/$lane"

  echo
  echo "Stage this lane:"
  printf "git add --"
  while IFS= read -r entry; do
    [ -n "$entry" ] || continue
    path="${entry:3}"
    printf " %s" "$(quote_path "$path")"
  done < "$tmp_dir/$lane"
  echo
  echo
done

if [ -z "$(find "$tmp_dir" -type f -print -quit)" ]; then
  echo "Worktree is clean."
fi
