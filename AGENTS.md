# Sensory Analysis Dashboard - Codex Operating Guide

This project is a React/Vite sensory analysis dashboard with Supabase-backed workflows. Work like a senior engineer: keep the scope tight, preserve user work, and use Ruflo only when it adds real leverage.

## Core Rules

- Do exactly what was asked; avoid opportunistic refactors.
- Always read a file before editing it.
- Prefer editing existing files over creating new ones.
- Do not create documentation files unless explicitly requested.
- Do not save working files, experiments, or tests in the repo root. Use `/src`, `/tests`, `/docs`, `/config`, or `/scripts`.
- Never commit secrets, credentials, `.env` files, local databases, build output, or OS metadata.
- Never add `Co-Authored-By` trailers unless `.codex/settings.json` explicitly enables attribution.
- Keep files under 500 lines where practical. If a necessary change would exceed that, split by existing domain boundaries.
- Validate input at system boundaries: routes, forms, uploads/imports, Supabase calls, edge functions, CSV parsing, and external data.
- Preserve unrelated user changes in the worktree. Stage and commit only files touched for the requested task.

## Default Workflow

1. Inspect the relevant files with `rg`, `rg --files`, `sed`, or focused reads.
2. Decide the smallest safe implementation path.
3. Make scoped edits with `apply_patch`.
4. Run the relevant verification for the files changed.
5. Review the diff before committing or pushing.

Use direct work for simple changes. Bring in Ruflo memory, routing, agents, or swarms only when the task is complex, risky, repeated, or spans multiple areas.

## Ruflo Decision Ladder

| Task shape | Approach |
| --- | --- |
| Single-file edit, small bug, copy tweak, config tweak | Work directly. No swarm. |
| 2-3 related files or unclear existing pattern | Use `memory_search` if past patterns may matter; optionally use guidance/routing. |
| Feature work, cross-module refactor, API/data model change | Use Ruflo guidance and consider a small agent team. |
| Security, auth, RLS, secrets, data privacy, permissions | Use security-focused review; verify boundary validation and least privilege. |
| Performance-sensitive dashboards, large data processing, imports | Use performance review and measure before/after where possible. |
| 5+ file changes or architecture uncertainty | Use a coordinated swarm with named agents and explicit handoffs. |

## Ruflo Tools

Use `ToolSearch` first when looking for Ruflo MCP tools. Prefer these when relevant:

- Memory: `memory_search`, `memory_store`, `memory_search_unified`
- Routing/guidance: `hooks_route`, `guidance_recommend`, `guidance_workflow`
- Agents: `agent_spawn`, `agent_list`, `agent_status`
- Swarm: `swarm_init`, `swarm_status`, `swarm_health`
- Security: `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii`

Memory is for reusable lessons, not every successful edit. Store a memory only when it captures a durable project pattern or a non-obvious fix likely to matter again.

## Agent Coordination

Named agents coordinate through `SendMessage` when that capability is available. Do not use agents as ceremony; use them to reduce risk or parallelize genuine independent work.

### Recommended Patterns

| Pattern | Flow | Use when |
| --- | --- | --- |
| Direct | Lead only | Small, obvious, low-risk work |
| Scout | Researcher -> Lead | Unknown code paths or dependency behavior |
| Pair | Architect/Reviewer <-> Lead | Design or risk review before edits |
| Pipeline | Researcher -> Architect -> Coder -> Tester -> Reviewer | Feature work with sequential dependencies |
| Fan-out | Lead -> Specialists -> Lead | Independent research, security, performance, UX review |

Agent rules:

- Always name agents so they are addressable.
- Always tell each agent who to message next and what result to send.
- Spawn coordinated agents together with `run_in_background: true` when using a pipeline.
- After spawning a background team, tell the user what is running and wait for agent results.
- Do not poll shared state when agents can message back.

## Verification

This repo uses pnpm and exposes these scripts:

```bash
pnpm run build
pnpm test
pnpm test:watch
```

Verification expectations:

- Code changes: run focused tests when available, then `pnpm run build`.
- Shared logic, data transforms, hooks, auth, Supabase, or user-facing workflows: run `pnpm test` and `pnpm run build`.
- Documentation/config-only changes: validate formatting and review the diff; build is optional unless the config affects runtime.
- Before committing: run `git diff --check` and inspect `git diff`.

If dependency installation or network access is required, ask for approval through the sandbox escalation flow.

## Git Discipline

- Check `git status --short --branch` before edits and before staging.
- Do not stage unrelated modified or untracked files.
- Use clear, conventional commit messages such as `docs: tighten codex operating guide`.
- Push only after verification succeeds or after clearly documenting why a check could not be run.

## Project Notes

- Frontend code lives under `/src/app`.
- UI components live under `/src/app/components` and `/src/app/components/ui`.
- Shared app utilities live under `/src/app/utils` and `/src/app/lib`.
- Supabase schema and edge functions live under `/supabase`.
- Migrations live under `/migrations` and `/supabase/migrations`.
- Sample CSVs live under `/public`; do not overwrite them unless the task explicitly involves imports or examples.
