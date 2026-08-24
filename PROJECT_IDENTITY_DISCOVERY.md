# Project identity architecture decision

Status: implemented on 25 June 2026 by migration
`20260625000000_projects.sql`.

## Context

The early application treated a “project” as a UI label derived from one active
import batch. That model could not represent a product-development programme
across reformulation rounds, connect evidence to a stable business entity, or
support reliable project-level decisions, concepts, and reports.

## Decision

`public.projects` is the canonical project entity. Directly project-scoped
records carry a `project_id` foreign key, including import batches,
instrumental samples, studies/products, decisions, concepts, and reports. A
project belongs to one organization and food type; tenant access is enforced by
Row Level Security.

The migration intentionally linked only records whose lineage was provable.
Historical rows with ambiguous batch identity stayed unlinked rather than
inventing provenance. The later reconciliation view and the audit in
`docs/prototype-lineage-review-2026-08-12.md` keep those cases visible for
operator review.

## Invariants

- Schema identity leads; UI state never creates a shadow project identifier.
- `database.types.ts` is generated from the linked live schema and is not edited
  by hand.
- Evidence, decisions, concepts, and reports must agree on project scope.
- A confirmed GO decision remains a prerequisite for Concept Lab and
  commercialization-report work.
- Missing historical lineage stays explicit and unresolved until authoritative
  source records are available.

## Consequences

The application can present one continuous Data → Studies → Responses →
Insights → Decision → Concept → Report journey, while preserving tenant
isolation and evidence provenance. Import batches remain useful operational
events, but no longer define project identity.

The original discovery transcript and implementation checklist were removed
after this decision was implemented; this concise record remains because the
foundational migration references it.
