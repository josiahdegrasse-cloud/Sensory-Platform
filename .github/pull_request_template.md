## Summary

Describe the user problem and the completed behavior.

## Product and AI impact

- User-facing workflow affected:
- Evidence or source-of-truth changes:
- AI input/output contract changes:
- Human review or approval impact:

## Verification

- [ ] Typecheck
- [ ] Lint
- [ ] Unit tests and coverage
- [ ] Browser smoke tests, when user-facing
- [ ] Production build and bundle budget
- [ ] Screenshots attached for visual changes

## Data and release safety

- [ ] No schema change
- [ ] Or: live schema inspected, migration added, generated types refreshed,
      and the schema drift gate passes
- [ ] Tenant/RLS boundaries reviewed
- [ ] GO/TWEAK/STOP gating is preserved
- [ ] No secrets, personal data, raw evidence chunks, or internal paths exposed

## Rollback

Describe the safest rollback or feature-disable path.
