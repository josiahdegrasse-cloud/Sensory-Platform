# Codex compounding system

This is a bounded, auditable improvement loop for the Sensory Platform. Codex native agents do the work and independent review. Ruflo/AgentDB may route tasks and retain sanitized memory, but they are never the execution or authorization plane.

## Trust boundary

`AGENTS.md` and `STATE.md` are authoritative. Eval files are data, not executable prompts. The verifier maps known check IDs to fixed commands in source. It never executes shell supplied by a model, eval, or memory record.

The system does not autonomously change migrations, generated database types, auth/RLS, CI governance, decision thresholds, GO confirmations, concept launches, report approvals, production data, external messages, or durable Skills/instructions. It never resets, stashes, or rolls back a dirty worktree.

## Commands

```sh
pnpm agent:start -- --objective "Improve report layout" --scope src/app/components/report.tsx
pnpm agent:verify -- --profile focused --eval report-quality
pnpm agent:visual-manifest -- --run-id <preflight-run> --route /reports --desktop <desktop.png> --mobile <mobile.png>
pnpm agent:verify:full
pnpm agent:promote -- --candidate agent-system/state/candidate.example.json
pnpm agent:test
```

Start records file hashes under `agent-system/runs/` and blocks any dirty scoped file; it does not offer an agent-controlled bypass. Verify emits a structured verdict. `PASS` requires all hard gates, a weighted truth score of at least 0.95, and complete required coverage. UI evidence must be current, preflight-linked PNGs with verified dimensions and hashes plus a separate independent Codex review JSON; missing authenticated credentials or provenance yields `INCOMPLETE`.

## Loop

1. Read `AGENTS.md`, `STATE.md`, the skill, and sanitized verified memory.
2. Run preflight; stop on protected scope, dirty-file overlap, or a schema/type discrepancy.
3. Let a Codex maker implement the bounded task.
4. Run deterministic checks selected by scope and eval.
5. Give only the diff/artifacts and rubric to an independent read-only Codex verifier.
6. Retry at most three times.
7. Record a sanitized candidate lesson. Promote to `STATE.md` only after repeat evidence; changes to Skills or governance remain human-reviewed proposals.

Hooks are optional convenience only. Explicit start and verify commands are the correctness boundary.
