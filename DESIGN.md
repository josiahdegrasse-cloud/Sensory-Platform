# Sensory Platform Design Contract

The product is a project-first workflow for food innovation evidence: Data -> Studies -> Insights -> Decision -> Concept -> Report. Screens should feel calm, operational, and client-ready. Avoid treating each module as a separate app. Panel responses are collected and monitored inside Studies, then interpreted in Insights; they are not a separate top-level destination.

## Navigation

- The primary admin path is `/project/:projectId/...` whenever a project is selected.
- Legacy paths such as `/stage1`, `/admin`, `/survey-analysis`, `/decision`, `/concept-testing`, and `/reports` are compatibility routes, not the preferred product model.
- Food type is project metadata and a filter. It is not the main information architecture.
- Destructive project actions must be explicit, reviewed, and confirmed. No project or import cleanup runs automatically from app boot.

## Status Language

- Use clear operational states instead of vague progress labels.
- Reports use exactly these external-readiness states:
  - `Client-ready`: approved and eligible for external delivery.
  - `Internal draft`: exportable internally, approval still pending.
  - `Demonstration only`: uses reference/demo evidence and cannot support external approval.
  - `Blocked`: evidence, context, or QC blockers prevent export.
- Concept visuals use `AI draft`, `Approved`, and `Blocked` provenance states.
- Demo/reference evidence must stay visible anywhere it influences a decision, report, or export.

## Components

- Product pages use restrained surfaces, compact headers, and dense but scannable panels.
- Cards are for individual records, repeated items, modals, and framed tools. Do not nest cards.
- All non-circular corners use the same 8px radius across controls, cards, panels, menus, and
  dialogs. Standard radius utilities from `rounded-xs` through `rounded-2xl` intentionally resolve
  to that one value. Status badges and selection chips also use the 8px radius. Use `rounded-full`
  only for true circles, avatars, indicator dots, and progress tracks; do not introduce arbitrary
  radius values.
- Primary actions use the same button vocabulary across pages. Link-based actions should use `Button asChild`.
- Loading states should use row or panel skeletons. Avoid replacing action labels with indefinite “Checking...” across a whole list.
- Sticky action bars must stay in the document flow and reserve their own space. Do not use fixed footers that cover form validation or required fields.

## Study Method Colors

Within the Studies workspace only, color provides a stable method taxonomy and is always paired
with a distinct icon and written label; users must never need color alone to identify a study.

- Blue = product sensory profiling: analytical measurement of one product through CATA,
  intensity, liking, and emotional response.
- Purple = triangle and multi-sample discrimination: comparison between coded samples and
  detection of difference. Purple keeps this method distinct from GO/TWEAK/STOP status colors.
- Teal = concept testing: exploratory, market-facing validation of positioning, imagery, claims,
  pricing, and purchase intent.

These hues identify study methodology, not lifecycle state. Draft, active, closed, archived,
blocked, and completed must continue to use the shared status vocabulary regardless of study type.

## Evidence And Governance

- Any claim, recommendation, chart, image, or report section should expose source quality when available: live, reference/demo, none, sample size, blocker, and export eligibility.
- AI-generated assets remain drafts until approved. Generated images and report drafts need visible provenance and usage eligibility.

## Mobile

- Mobile admin screens collapse navigation before content. Horizontal nav may scroll, but it must not hide the current project context.
- Tables and report vault rows should become stacked record summaries with the same state badges and actions.
- Panelist-facing screens should not inherit admin chrome unless the admin is previewing them.
