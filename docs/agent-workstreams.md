# Agent Workstreams

This note coordinates parallel agent work in the Sensory Platform repo.

## Active Coordination Rules

- Keep workstream commits scoped. Stage explicit files only.
- Do not hand-edit `src/app/lib/db/database.types.ts`.
- Do not add or modify migrations without first confirming the current live schema state.
- If any mismatch appears between the live schema, migrations, app code expectations, or
  `database.types.ts`, stop and report before fixing it.
- Avoid touching files already changed by another agent unless that workstream owns the area.

## Recommended Workstreams

### Project Identity Cleanup

Owner: unassigned.

Purpose: make `projects` the obvious unit across dashboard, imports, decisions, concepts, and
reports.

Likely files:

- `src/app/components/project-command-center.tsx`
- `src/app/lib/project-identity.ts`
- `src/app/lib/project-status.ts`
- `src/app/lib/db/projects.ts`

Coordination note: this lane may touch schema-facing behavior. Apply the schema/type stop rule.

### Mock and Demo Data Isolation

Owner: unassigned.

Purpose: keep production workflows from depending on `mock-users`, `mock-data`, or temporary demo
fixtures except through explicit demo-only modules.

Likely files:

- `src/app/data/mock-users.ts`
- `src/app/data/mock-data.ts`
- `src/app/data/temporary-cheese-demo.ts`
- consumers in `src/app/components` and `src/app/lib`

Coordination note: this lane should prefer type extraction and import cleanup before behavior
changes.

### CI and Schema Drift Guard

Owner: unassigned.

Purpose: make schema drift checks, generated type sync, typecheck, unit tests, and smoke e2e checks
clear in CI.

Likely files:

- `.github/workflows/ci.yml`
- `scripts/check-migration-drift.sh`
- `package.json`

Coordination note: do not regenerate or edit `database.types.ts` unless the live schema has been
confirmed and the mismatch has been reported.

### Journey UX Consolidation

Owner: unassigned.

Purpose: make the admin experience feel like one project journey rather than separate tools.

Likely files:

- `src/app/components/main-layout.tsx`
- `src/app/components/project-journey-nav.tsx`
- `src/app/components/project-workflow-progress.tsx`
- route consumers in `src/app/routes.tsx`

Coordination note: avoid overlapping with Project Identity Cleanup unless the same owner is handling
both.

## Current Dirty Areas To Avoid

As of the latest local audit, unrelated pending changes already exist in these broad areas:

- `.claude/skills/impeccable/**`
- `.cursor/skills/impeccable/**`
- `.codex/hooks.json`
- `.cursor/hooks.json`
- `CLAUDE.md`
- `agentdb.rvf.lock`
- `src/app/components/**`, especially project, survey, concept, report, admin, and questionnaire
  screens
- `src/app/contexts/food-type-context.tsx`
- `src/app/data/**`, including apparent mock/demo data isolation work
- `src/app/lib/**`, including db products/responses, hooks, project status, studies, workflow, and
  report evidence source modules
- `src/app/routes.tsx`
- `src/app/utils/panelist-metrics.ts`
- `zen-agentic-engineer-config/`

Treat those as owned by other work unless explicitly assigned.
