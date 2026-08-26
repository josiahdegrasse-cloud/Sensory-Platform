# Product principles

## Users

Two roles, two working contexts:

- **Administrators** — R&D and product-development managers at food companies,
  or consultants serving them. They move products through lab-to-market
  validation and need to know each project's status, evidence, and next action.
- **Panelists** — consumer testers completing assigned sensory and concept
  studies, often on a tablet or phone in short, focused sessions.

## Product purpose

Sensory Platform is a multi-tenant workspace that moves a food product through
one connected journey: instrumental data import → deterministic food-category
classification → reviewed study setup → panel responses → insights →
GO/TWEAK/STOP decision → Concept Lab → concept feedback → branded
commercialization report.

Success means an administrator can open any project and immediately understand
its stage, evidence, current recommendation, and next action. The final report
should preserve that lineage in a client-ready document under the client's own
brand.

## Brand personality

Calm, confident, and client-ready. The interface should feel like a lab notebook
that grew into a boardroom deliverable: evidence-dense without becoming noisy.
AI retrieves and drafts inside explicit evidence boundaries; deterministic code
calculates scores and enforces gates; administrators review important outputs.

## Anti-references

- Generic SaaS analytics dashboards with chart walls, hero metrics, or filler
  KPIs.
- Disconnected modules with unrelated navigation or feature-specific visual
  themes.
- Gamified or animation-heavy dashboards.
- AI output presented as fact without provenance or an approval gate.
- Cost-savings or usage-meter framing; this is a research instrument, not a
  billing console.

## Design principles

1. **One journey, not seven tools.** Every administrator screen belongs to the
   same Project → Evidence → Decision → Concept → Report path.
2. **Color conveys meaning, not feature identity.** Hue encodes status and
   decision semantics; an icon and label always carry the same meaning.
3. **Evidence before claims.** Every metric and chart carries provenance—live
   panel, imported instrument, reference/demo, AI draft, or approved—and a
   sample size where known.
4. **The next best action is always one glance away.**
5. **AI proposes; administrators approve.** Important AI outputs remain in a
   review state until a person signs off.

## Accessibility and inclusion

The product targets WCAG 2.1 AA. Body text should maintain at least 4.5:1
contrast against its surface. Status must never rely on color alone. Steppers,
review actions, and survey forms must remain keyboard-operable, and transitions
must honor `prefers-reduced-motion`.
