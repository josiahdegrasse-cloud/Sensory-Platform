---
name: report-polish
description: Improve the Commercialization Report into a polished, client-facing deliverable.
---

# Report Polish

Goal:
Make the report feel like the final client-facing deliverable:
formulation data → sensory evidence → decision rationale → concept feedback → commercialization recommendation.

Before editing:
1. Inspect the current report component.
2. Identify data sources.
3. Identify missing empty states.
4. Identify unsupported or weak claims.
5. Propose a plan before editing.

Report structure:
1. Header
2. Executive Summary
3. Product Snapshot
4. Sensory & Instrumental Evidence
5. Decision Rationale
6. Marketing Concept Results
7. Final Commercialization Recommendation
8. Appendix

Rules:
- Do not build a cost-savings feature.
- Do not rewrite the whole app.
- Preserve existing data hooks and export logic.
- Do not invent unsupported claims.
- Keep the main body readable.
- Put dense technical detail in the appendix.
- Use data provenance badges.
- Keep branding tenant/client-configurable.
- Make sure export/print still works.

After editing:
1. Run typecheck.
2. Run lint.
3. Run relevant tests.
4. Summarize changed files.
5. Note what needs browser/PDF review.
