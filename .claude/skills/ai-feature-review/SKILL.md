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
