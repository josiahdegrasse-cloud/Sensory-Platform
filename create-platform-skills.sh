#!/usr/bin/env bash
set -e

echo "Creating platform skills..."

mkdir -p .claude/skills/quality-gate
mkdir -p .claude/skills/ai-feature-review
mkdir -p .claude/skills/tenantization-review
mkdir -p .claude/skills/report-polish
mkdir -p .claude/skills/demo-flow-check
mkdir -p .claude/skills/architecture-map

cat > .claude/skills/quality-gate/SKILL.md <<'SKILL'
---
name: quality-gate
description: Run project verification before commit or deploy.
---

# Quality Gate

Run the available project checks from package.json.

Preferred checks:
1. TypeScript typecheck
2. ESLint
3. Unit tests
4. Build

Rules:
- Do not claim success unless commands pass.
- If a command fails, explain the exact command, file, error, likely cause, and recommended fix.
- Do not fix failures unless explicitly asked.
- Keep the summary short and actionable.

Return:
1. Typecheck status
2. Lint status
3. Test status
4. Build status
5. Failures
6. Risk level
7. Recommended next action
SKILL

cat > .claude/skills/ai-feature-review/SKILL.md <<'SKILL'
---
name: ai-feature-review
description: Review an AI-assisted feature for context, structured output, validation, human review, and source-of-truth safety.
---

# AI Feature Review

Use this for AI features such as:
- food/category detection
- AI survey generation
- concept generation
- image prompt generation
- report narrative generation
- panelist comment summarization

Review checklist:

1. User problem
What workflow pain does the AI reduce?

2. Context
What data is sent to AI?
Check for project, food type, sample names, instrumental data, survey data, decision rationale, concept results, client profile, and brand tone.

3. Output contract
Does AI return structured output the UI can render?
Are fields predictable?
Are unsupported question types prevented?

4. Validation
Before saving AI output:
- validate required fields
- validate supported types
- validate scale ranges
- validate report claims against real data
- reject or repair unsupported output

5. Human review
Important outputs should follow:
AI drafts → code validates → admin reviews/edits → admin approves → database saves.

6. Source of truth
Confirmed outputs belong in database records.
Temporary guesses belong in React state until confirmed.

7. AI vs code
AI may classify, draft, summarize, and explain.
Code should calculate scores, determine winners, enforce thresholds, validate schemas, save records, and enforce permissions.

8. Failure states
What happens if AI fails, returns invalid JSON, has low confidence, or missing data?

Return:
1. Feature summary
2. Strong design choices
3. Risks
4. Missing validation
5. Missing human control
6. Backend/frontend boundary issues
7. Database/source-of-truth issues
8. Recommended fixes
SKILL

cat > .claude/skills/tenantization-review/SKILL.md <<'SKILL'
---
name: tenantization-review
description: Review whether the platform supports multiple companies/tenants instead of being hardcoded to one client.
---

# Tenantization Review

Review the app as a multi-company food innovation platform.

Core question:
Would this work for a second company without rewriting the app?

Check for hardcoded:
- company names
- New Food Innovation copy
- logos
- colors
- report footer text
- panelist intro copy
- report tone
- food categories
- default settings
- Supabase queries without tenant/workspace scope
- Edge Functions that do not scope reads/writes by tenant
- AI prompts that could include the wrong client's data

Separate:

Platform-standard:
- import workflow
- survey generation workflow
- Insights
- GO/TWEAK/STOP logic
- Concept Lab structure
- report structure
- validation rules
- data provenance badges

Tenant-specific:
- company name
- logo
- colors
- report tone
- footer
- default copy
- report branding
- client-specific categories/settings

Return:
1. Hardcoded client assumptions
2. Tenant isolation risks
3. Config fields needed
4. Files/components to change
5. Database or RLS concerns
6. Highest-priority fixes
SKILL

cat > .claude/skills/report-polish/SKILL.md <<'SKILL'
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
SKILL

cat > .claude/skills/demo-flow-check/SKILL.md <<'SKILL'
---
name: demo-flow-check
description: Check whether the app tells a clean demo story from CSV import to commercialization report.
---

# Demo Flow Check

Review whether the platform supports a clear demo flow:

CSV upload
→ AI detects food type/category
→ AI generates sensory survey
→ admin reviews/approves
→ panelists respond
→ Insights summarize results
→ Decision Engine gives GO/TWEAK/STOP
→ GO sample moves to Concept Lab
→ AI generates concepts/images/surveys
→ panelists choose preferred direction
→ Commercialization Report recommends what to do next

For each stage, check:
1. Is the user goal clear?
2. Is the next step obvious?
3. Is there a dead end?
4. Are empty states helpful?
5. Is the data source clear?
6. Is language non-technical enough for Alan/client?
7. Does it avoid prototype vibes?
8. Does the transition to the next stage work?

Return:
1. Demo flow summary
2. Where the story is strong
3. Where the story breaks
4. Confusing UI/copy
5. Missing transitions
6. Highest-impact fixes before demo
SKILL

cat > .claude/skills/architecture-map/SKILL.md <<'SKILL'
---
name: architecture-map
description: Explain the architecture and data flow of a feature before editing.
---

# Architecture Map

Use this before changing a major feature.

Do not edit files unless explicitly asked.

Map the feature across:

1. User flow
What does the user click, see, edit, confirm, or export?

2. Frontend
Which React pages/components are involved?
What is state?
What is props?
What is conditional UI?

3. Backend
Which API routes, Supabase Edge Functions, or secure logic are involved?

4. Database
Which records are read or written?
What is source of truth?
What relationships connect the data?

5. AI
Where is AI used?
What context is sent?
What output is expected?
What validates the output?

6. Human review
Where does admin approve/edit?
What cannot go live automatically?

7. Failure states
What happens if data is missing, AI fails, auth fails, or export fails?

8. Risks
What could break if this is changed?

Return:
1. Architecture summary
2. Data flow diagram in text
3. Important files
4. Source-of-truth records
5. Frontend/backend/AI/database responsibilities
6. Recommended implementation plan
SKILL

echo "Done."
echo "Created skills:"
echo "  .claude/skills/quality-gate"
echo "  .claude/skills/ai-feature-review"
echo "  .claude/skills/tenantization-review"
echo "  .claude/skills/report-polish"
echo "  .claude/skills/demo-flow-check"
echo "  .claude/skills/architecture-map"
