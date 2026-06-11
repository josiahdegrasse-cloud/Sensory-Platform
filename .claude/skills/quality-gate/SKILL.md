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
