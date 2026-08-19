# Human Factors Through the Sensory Platform

This folder contains screenshots captured from the live local application. Files marked `bad` are genuine current usability issues or system weaknesses, not staged mockups. Files marked `mixed` show a useful pattern with a tradeoff.

## Recommended core slideshow sequence

| Image | HFE lesson | Suggested teaching point |
|---|---|---|
| `01-good-login-clear-hierarchy.png` | Visual hierarchy and task focus | A single dominant task, familiar labels, restrained choices, and high contrast reduce orientation time. |
| `04-good-overview-progressive-workflow.png` | Situation awareness | Users can see current state, completed work, blocked stages, evidence, and the next action without remembering the process. |
| `05-good-project-switcher-reduces-clutter.png` | Recognition over recall | Search, recent items, labels, and status replace a permanently visible project ledger. |
| `06-good-evidence-lineage-and-next-action.png` | Traceability and action mapping | The interface answers “what evidence exists?”, “what is missing?”, and “what do I do next?” in one view. |
| `07-good-executive-brief-information-layering.png` | Role-based information design | Executives receive the decision, evidence boundary, and next gate without the full R&D detail. |
| `08-good-client-brief-evidence-boundaries.png` | Calibrated communication | The client view explicitly prevents product evidence from being misread as market proof. |
| `09-good-decision-thresholds-and-evidence-status.png` | Decision support | A fixed threshold, distance-to-target, status labels, and reasons make a TWEAK decision inspectable. |
| `11-good-confirmed-go-and-next-paths.png` | Closure and next-step clarity | Confirmation is visually persistent and the two legitimate downstream paths are immediately available. |
| `12-good-stop-state-hazard-salience.png` | Hazard communication | STOP uses redundant cues—label, colour, position, score, failed gates, and direct language. |
| `17-good-release-checklist-error-prevention.png` | Error prevention | Export and approval are blocked until evidence, legal, and quality checks are satisfied. |
| `18-good-data-master-detail-and-recognition.png` | Master-detail navigation | Persistent sample identity and visible data categories reduce memory burden during comparison. |
| `20-good-mobile-overview-responsive-layout.png` | Responsive task continuity | The same project state and next actions remain legible on a small screen. |
| `22-bad-mobile-data-chart-content-clipping.png` | Responsive failure | The sample rail collapses into clipped labels and consumes scarce width, weakening identification and comparison. |
| `15-bad-concept-tag-option-overload.png` | Choice overload | A long evidence paragraph plus dozens of undifferentiated tags increases scanning, decision fatigue, and error risk. |
| `23-bad-project-state-mismatch-zero-samples.png` | Automation surprise and trust | The header says the Cheese project is active while the decision page says zero machine samples, contradicting visible project history. |
| `26-bad-empty-literature-service-dependency.png` | Resilience and recovery | The system exposes that research is unavailable, but offers little diagnosis or meaningful work from the empty state. |

## Additional good-HFE examples

| Image | Principle |
|---|---|
| `02-good-privacy-progressive-disclosure.png` | Plain-language privacy information and chunking. |
| `03-good-consent-risk-communication.png` | Informed consent, voluntariness, risks, and confidentiality. |
| `10-good-graceful-degradation-with-retry.png` | A secondary AI service can fail without blocking the deterministic decision workflow. |
| `14-good-concept-provenance-and-step-gating.png` | The concept inherits a confirmed source decision and prevents skipping required steps. |
| `16-good-report-versioning-and-release-review.png` | Version, status, source decision, confidence, and report navigation remain visible. |
| `19-good-study-filters-progress-and-safety-check.png` | Study-type recognition, status filters, progress, blockers, and formulation safety guidance. |
| `21-good-mobile-navigation-progressive-disclosure.png` | The full workflow is placed behind a compact mobile menu. |
| `24-good-insights-prototype-summary.png` | Prototype identity, evidence volume, status, and recommended action share one summary. |
| `25-good-insights-evidence-provenance-and-charts.png` | Chart scale, sample identity, uncertainty note, and live-data provenance appear together. |
| `27-good-settings-chunking-and-safe-defaults.png` | Settings are chunked by user goal and use explicit descriptions around switches. |
| `28-good-operational-visibility-and-cost-controls.png` | Health, failures, cost ceilings, and recovery limits are visible to administrators. |
| `29-good-audit-trail-accountability.png` | Actor, action, target, metadata, and time support accountability and incident reconstruction. |

## Mixed examples

| Image | Tradeoff |
|---|---|
| `09-mixed-switcher-overlay-interrupts-decision-task.png` | The switcher improves global navigation, but its large overlay can temporarily obscure a high-stakes decision. |
| `13-mixed-concept-gating-but-duplicate-options.png` | Confirmed-GO gating is strong, but duplicate-looking decisions make source selection harder. |

## Suggested comparison slides

1. **Memory vs visibility:** `04` beside a workflow described only in prose.
2. **Technical detail vs role fit:** `06` beside `07` and `08`.
3. **Decision-state salience:** `09`, `11`, and `12` as a three-image sequence.
4. **Prevention vs recovery:** `17` beside `26`.
5. **Desktop vs mobile:** `18` beside `22`.
6. **Guidance vs overload:** `14` beside `15`.
7. **Trust through consistency:** `24` beside `23`.

