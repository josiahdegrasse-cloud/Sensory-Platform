---
name: sensory-compounding-loop
description: Run bounded, evidence-backed Codex maker-verifier loops for multi-file features, risky fixes, UI polish, report logic, and recurring repository work in the Sensory Platform. Use when a task should leave auditable state and verified reusable lessons for later sessions.
---

# Sensory Compounding Loop

## Purpose

Make each meaningful Codex run safer and more useful to the next run without pretending the model changes its weights. The repository compounds through verified state, evals, and sanitized memory.

Read [policy.md](references/policy.md) before acting. Read [tool-map.md](references/tool-map.md) when choosing execution or memory tools.

## Workflow

1. Read root `AGENTS.md`, root `STATE.md`, the task, and relevant code. Search only the sanitized verified-pattern memory namespace.
2. Route the task with Ruflo metadata when available. Use native Codex agents for execution. Write a bounded plan with a maximum of three make/verify iterations.
3. Run `pnpm agent:start -- --objective "..." --scope path[,path]`. Any dirty scoped path is BLOCKED with no acknowledgment bypass; use a clean isolated checkout or a deliberate user-provided clean patch baseline. Stop on protected scope or schema/type mismatch.
4. Assign one maker a concrete scope. For UI work require rendered desktop and mobile evidence. For reports require report QC/evidence gates. For Concept or Report preserve confirmed-GO gating.
5. Run `pnpm agent:verify -- --profile focused --eval <case-id>`. Combine cases with comma-separated IDs, or use `report-ui-safety` for report interface work. UI verification requires a READY preflight-linked capture manifest and a separate Codex verifier review: `--visual-manifest <json> --visual-review <json>`. Use `pnpm agent:visual-manifest` after capture. Use `--profile full` before completion when risk warrants it.
6. Give a different Codex verifier only the objective, rubric, raw diff, deterministic report, and visual artifacts. The verifier must be read-only and must not see maker reasoning.
7. If FAIL, send the artifact-grounded gaps to the maker and retry. Stop after three iterations. If required proof cannot run, return INCOMPLETE.
8. Record a sanitized candidate lesson only after root cause is verified. Promote it with `pnpm agent:promote -- --candidate <file>` after repeat-evidence and approval requirements pass. Store the resulting sanitized payload in AgentDB. Never auto-edit this Skill or `AGENTS.md`.
9. Update `STATE.md` resume information before finishing. Report checks run, skipped evidence, blockers, and memory promoted.

## Verdict rules

- PASS: all hard gates pass, truth score is at least 0.95, and required coverage is 100%.
- FAIL: any hard gate fails or the artifact contradicts the objective or repository rules.
- INCOMPLETE: a required check is skipped, unavailable, or lacks genuine visual/authenticated evidence.
- BLOCKED: protected scope, schema checkpoint, dirty overlap, or missing human authorization prevents safe work.

Never convert INCOMPLETE or BLOCKED to PASS through narrative judgment.
