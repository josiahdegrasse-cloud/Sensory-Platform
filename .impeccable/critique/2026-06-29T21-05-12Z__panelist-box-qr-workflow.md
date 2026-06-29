---
target: panelist-box-qr-workflow
total_score: 24
p0_count: 0
p1_count: 4
timestamp: 2026-06-29T21-05-12Z
slug: panelist-box-qr-workflow
---
**Scope**
Panelist at-home tasting box workflow: admin box pass generation, print insert/QR handoff, panelist QR join/onboarding, panelist task dashboard, and supporting panelist kit RPC client code.

**Scores**
- Nielsen human factors score: 24/40
- Technical/design health: 15/20
- P0 issues: 0
- P1 issues: 4
- P2 issues: 5

**Findings**
1. P1 - Admin task selection is too easy to get wrong. The box builder pulls broad active products and lets admins assign several tasks without a packing verification step, project grouping, sample-code matching, or final review.
2. P1 - The QR join flow loses trust in two places: success and error messages share destructive styling, and email-confirmation signup tells users to scan again instead of preserving the claim context.
3. P1 - The panelist dashboard does not connect physical samples to digital tasks strongly enough. It lacks sample codes, recommended tasting order, deadlines, and expected time per task.
4. P1 - Issue reporting is mostly post-auth even though one of the issue reasons is sign-in trouble. A panelist who cannot sign in needs a support path from the QR/manual-code screen.
5. P2 - Admin fulfillment actions use browser prompts for shipping, replacement, and void reasons. These are brittle, easy to dismiss, and weak for audit-quality operations.
6. P2 - The Reminder action appears to send a reminder but currently records a reminder event. The label should distinguish logging from actual messaging until a sender exists.
7. P2 - Language still mixes kit, box, sample, and pass in several surfaces and CSV headers. This adds avoidable cognitive load.
8. P2 - Printed fallback details could be more scan- and print-ready: larger manual code, clearer box recipient label, task count, deadline, and support fallback.
9. P2 - Admin monitoring only shows completed count, not which tasks are incomplete or where a panelist is stuck.

**Human Factors Notes**
- Error prevention is the biggest opportunity: prevent wrong tasks from being packed or assigned before the QR ever reaches a panelist.
- Recognition over recall needs more work: panelists should match "Sample A" in the box directly to "Task A" in the dashboard.
- Feedback and recovery need polish: every state should clearly say whether something was sent, logged, claimed, expired, or blocked.
- Progressive disclosure is close but not finished: admin actions and panelist safety checks should reveal detail only when needed.

**Recommended Direction**
Build a box workflow around one reviewed pack list, one box pass per panelist, and one mobile task queue. Admin flow should become Pack list -> Review boxes -> Generate QR passes -> Print inserts -> Ship/monitor. Panelist flow should become Scan -> Sign up/sign in -> Box auto-claimed -> See assigned tasks in tasting order -> Complete each sample -> Report issue anytime.

**Verification**
- Deterministic design detector: clean.
- ESLint on audited files: clean.
- Browser visual pass: not run in this snapshot.
