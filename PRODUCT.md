# Product

## Register

product

## Users

Two roles, two contexts:

- **Admins** — R&D and product-development managers at food companies (or consultants serving them). At a desk, mid-task, often with a client on a screen-share. They run a product through lab-to-market validation and need to know, per project: where it stands, what evidence exists, and what to do next.
- **Panelists** — semi-trained consumer testers completing sensory and concept surveys, frequently on tablets or phones, in short focused sessions.

## Product Purpose

A multi-tenant platform that moves a food product through one connected journey: machine data import → AI food/category detection → AI-generated sensory survey → panel responses → insights → GO/TWEAK/STOP decision (ISSF score) → Concept Lab → panelist concept feedback → branded commercialization report.

Success looks like: a user opens any project and immediately understands its stage, its evidence, its current recommendation, and the next best action. The commercialization report lands as the final payoff of the journey, client-ready under the client's own brand.

## Brand Personality

Calm, confident, client-ready. Premium food-industry professionalism, not flashy. AI is helpful but controlled: it drafts, detects, and suggests, and admins approve before anything goes live. The interface should feel like a lab notebook that grew up into a boardroom deliverable.

## Anti-references

- Generic SaaS analytics dashboards (chart walls, hero metrics, filler KPIs).
- The current state of this app: seven disconnected tools with per-feature color themes (orange = Concept Lab, purple = multi-sample, etc.).
- Gamified or animation-heavy dashboards.
- AI output presented as fact, with no provenance or approval gate.
- Cost-savings/usage-meter framing; this is a research instrument, not a billing console.

## Design Principles

1. **One journey, not seven tools.** Every admin screen locates itself on Project → Evidence → Decision → Concept → Report.
2. **Color is meaning, never feature identity.** Hue encodes status and decision semantics (GO/TWEAK/STOP, complete/current/blocked); features are identified by icon + label.
3. **Evidence before claims.** Every metric and chart carries provenance (live panel / imported instrument / reference-demo / AI draft / approved) and an n where known.
4. **The next best action is always one glance away.**
5. **AI proposes, admins approve.** Important AI outputs sit in a "needs review" state until a human signs off.

## Accessibility & Inclusion

WCAG 2.1 AA (project default; no stricter requirement stated). Body text ≥ 4.5:1 against its surface; status never encoded by color alone (always icon + label, which also covers the GO-green/STOP-red colorblind collision); steppers, review actions, and survey forms fully keyboard-operable; `prefers-reduced-motion` honored on every transition.
