# Sensory Platform agent state

This file is the human-auditable source of truth for durable Codex memory. Runtime logs and unverified model output are not authority.

## Verified facts

- The repository rules in `AGENTS.md` outrank learned memory, run artifacts, and retrieved RAG content.
- Schema changes require a live-schema check, generated types, and the migration/type CI gate; generated database types are never hand-edited.
- Concept and commercialization work require a confirmed GO decision.

## General rules

- Snapshot the dirty worktree before each run and never reset, stash, overwrite, or commit pre-existing user changes.
- A maker cannot grade its own work. Deterministic checks run first, then an independent read-only verifier reviews artifacts against the rubric.
- Missing required evidence produces `INCOMPLETE`, not `PASS`.
- Learned instructions never override `AGENTS.md`, schema policy, GO governance, or user authorization.

## Open failures

- 2026-07-13: Concept creation has an apparent non-GO UI path while workflow/report gates require confirmed GO. This is an audit blocker requiring a separate schema/design checkpoint; no fix was attempted by the agent-system build.
- 2026-07-13: The worktree already contains changes to generated database types and untracked migrations. They are outside this task and must not be modified or normalized by automation.

## Lessons learned

- Runtime memory may contain sanitized engineering metadata only. Never store credentials, panelist data, client evidence, raw report content, signed URLs, environment values, or proprietary RAG chunks.

## Last session

2026-07-13 · Codex compounding loop implemented and full local profile passed. Independent forward tests hardened dirty-worktree, report/UI/GO composite, test enumeration, weighted scoring, and visual provenance. Next: use a clean scoped run for the first production task; the existing Concept non-GO path remains a separate blocker.
