# Sensory Analysis Dashboard — Current Workflows & Pages (as of 2026-06-07)

This is a complete inventory of what exists today: every page, what it's for, what
a user can do on it, what data it touches, and how pages connect to each other.
It is meant as raw input for a redesign — it describes the *current* (messy,
disconnected) state, not a target state.

There are two roles: **admin** (the company/researcher side) and **panelist**
(the consumer/tester side). There are two parallel "tracks":

- **R&D Track**: import instrumental data → survey panel → analyze → GO/TWEAK/STOP decision
- **Marketing Track**: build a concept → survey panel about it → analyze responses

These two tracks currently feel disconnected from each other and from a shared
sense of "where am I in the process."

---

## Global state (lives outside any one page)

- **Auth**: Supabase email/password login. A user has a role (`admin` or
  `panelist`), status (`active`/`inactive`/`archived`), and consent tracking.
  Inactive/archived users get auto-logged-out.
- **Food Type**: a global "which product category am I working on" selector
  (e.g., cheese, bread, yogurt, meat). Almost every admin page filters by this.
  Admins can also select a specific **import batch** ("project") within a food
  type to scope down further.

---

## ADMIN PAGES

### 1. Overview Dashboard — `/`
**What it's for:** Landing page / hub for admins.
**What you can do:** See five module cards (Machine Testing, Analyze Results,
Final Decision, Concept Testing, Configure) and click through to each. Shows
two tracks side-by-side: R&D (instrumental → decision) and Marketing (concept
testing).
**Data:** Nothing fetched — pure navigation.
**Connects to:** `/stage1`, `/survey-analysis`, `/decision`, `/concept-testing`, `/admin`.

---

### 2. Import Instrumental Data — `/stage1`
**What it's for:** Upload raw lab/machine data: E-Tongue (taste), GC-MS
(volatile aroma compounds), and chemical composition CSVs.
**What you can do:**
- Upload a CSV for each of the three data types
- Map CSV columns to expected fields (with auto-inference)
- Review a validation report (errors/warnings)
- Confirm the import and see a summary
- See "Recommended next step" buttons after a successful import (send surveys
  to panel, view charts, or jump to concept testing)
**Data:** Writes to `instrumental_data`, `gcms_data`, `composition_data`,
`import_batches`. Creates an `import_batch_id` that tags this cohort of samples
for everything downstream.
**Connects to:** `/admin` (turn imported samples into surveyable products),
`/survey-analysis` (view charts of imported data).

---

### 3. Analyze Results / Survey Analysis — `/survey-analysis`
**What it's for:** The main analytics page — visualizes panelist feedback
(CATA, Intensity, Hedonic, Emotional) and compares it against the instrumental
data from Stage 1.
**What you can do:**
- Pick a food type and a sample (or switch to "compare all samples")
- Switch between three toggle "tiles": **Single Sample**, **Multi-Sample**,
  and **Concept Tests** (each renders a totally different sub-view)
- Within single/multi sample: tabs for CATA, Intensity, Hedonic, Emotional,
  Comments — each with charts (radar, bar, heatmap, word cloud)
- Within Concept Tests: pick a launched concept test and see per-question
  result charts (scale histograms, choice rankings, ranking aggregates,
  open-text lists) — read-only reporting
- Download CSV of raw responses
- Click "Move forward & write report" → `/decision`
**Data:** Reads `useProducts`, `useInstrumentalDataset`, `useSurveyData`,
and (for the concept tile) `useAdminConceptTests` / `useConceptTestResponses`.
Entirely read-only — no writes.
**Connects to:** `/admin` (empty-state CTA to create questionnaires),
`/decision` ("move forward" button), `/stage1` ("import more data").

---

### 4. Decision Engine — `/decision`
**What it's for:** Turn all the collected data (instrumental + panelist
feedback) into a GO / TWEAK / STOP recommendation per sample, using a scoring
model (the "Integrated Sensory Sensibility Framework").
**What you can do:**
- Pick a sample and see an ISSF score gauge (0–100) with GO/TWEAK/STOP zones
  (thresholds configurable in Settings)
- See *why*: for GO, dimension strengths; for TWEAK, an "actionable path to GO"
  (e.g., "reduce graininess → +8 points"); for STOP, the off-note compounds
  driving rejection
- Save ("log") a decision — this is recorded permanently with a rationale,
  scores, timestamp, and the admin's user ID
- View the decision log / history of past calls
- Download a decision report (Excel/PDF)
- For confirmed GO samples: open the **Commercialization Report Builder**
  (drafts a launch/marketing narrative) and/or jump straight into the
  **Concept Lab** with that sample's name/category pre-filled
**Data:** Reads instrumental + survey data + workspace thresholds; writes a
permanent `decision_record` (sample, verdict, scores, rationale, user, time).
**Connects to:** `/concept-testing` (pre-seeds a new concept from a confirmed
GO decision — name, category, and a starter description carry over).

---

### 5. Configure / Admin Config — `/admin`
**What it's for:** The control room for products (surveys), panelists,
templates, and import batches. Where raw imported samples become actual
surveys panelists can take.
**Four tabs:**
- **Products**: create/edit/archive/delete a product (survey); choose
  single-sample, multi-sample, or calibration type; set custom CATA
  attributes; assign specific panelists or leave open to all; filter/search
- **Panelists**: view roster, edit panelist IDs, change status
  (active/inactive/archived), see performance metrics (response rate,
  completion time, quality score, dropout)
- **Templates**: create/delete reusable questionnaire attribute templates per
  food type
- **Imports**: view import batches from Stage 1, archive them, bulk-create
  products directly from an import's samples, see data-integrity warnings
**Data:** Reads/writes `products`, `panelists`, `questionnaire_templates`,
`import_batches`.
**Connects to:** feeds the Panelist Dashboard (created products show up there);
the entry point for turning raw imports into live surveys.

---

### 6. Settings — `/settings`
**What it's for:** Workspace-wide configuration and an audit trail. The
"tuning knobs" page.
**Four areas:**
- **Workspace settings**: org name/contact/timezone/retention; questionnaire
  rules (require which sections, allow comments); import rules (auto-create
  food types/surveys, duplicate handling); panelist rules (consent, self-signup,
  panelist ID requirements); panel size defaults; Concept Lab limits (max
  generations, monthly budget, approval requirement); **Decision Engine
  thresholds** (GO ≥ 75, STOP ≤ 45 by default, min responses, lock-on-confirm);
  reporting options (anonymize, export format, footer text); notification toggles
- **Panelist roster**: status toggles, consent status, basic stats
- **Audit log**: a scrollable list of every tracked admin/system action
  (product created, import uploaded, decision logged, response submitted, etc.)
- **Concept settings**: read-only info on AI generation usage/quotas
**Connects to:** affects behavior on virtually every other admin page (it's
the source of truth for thresholds, defaults, and rules).

---

### 7. Concept Lab / Concept Testing — `/concept-testing`
**What it's for:** A wizard for building an AI-assisted "marketing concept"
survey — fast consumer research on a product idea, packaging, positioning, etc.
**Three-step wizard:**
1. **Brief**: name, category, consumer-facing description, target market, price
   point, key benefits, technical challenges, AI prompt style. (Can arrive here
   pre-filled from a confirmed GO decision on `/decision`.)
2. **Visuals & Questions**: upload/paste concept images; AI generates 5–30
   survey questions (scale, multiple-choice, ranking, open-text); edit/reorder
   them
3. **Panel & Review**: set panel size, optionally target specific panelists or
   segments, review everything, and launch
**After launch:** shows an invite/response-count view; can be closed early.
**Data:** Auto-saves a draft to localStorage every ~2s (so refresh doesn't lose
work); writes a `concept_tests` record on launch (questions, images, panel
size, assigned panelists, status).
**Connects to:** seeded by `/decision`; results show up back on
`/survey-analysis` under the Concept Tests tile; panelists answer it via
`/concept-survey/:id`.

---

## PANELIST PAGES

### 8. Panelist Dashboard — `/panelist`
**What it's for:** The panelist's home — "here's what you've been asked to do."
**What you can do:** See pending single-sample evaluations (blue cards),
pending multi-sample comparisons (purple cards), pending concept-test surveys
(orange cards), and a list of completed items. Each card shows an estimated
time and a "Start" button.
**Data:** Read-only; filtered to products/tests this panelist is assigned to
(or open to everyone if no specific assignment list).
**Connects to:** `/questionnaire-info/:id`, `/multi-sample-info/:id`,
`/concept-survey/:id`.

---

## SHARED SURVEY PAGES (panelist-facing, admin can preview)

### 9. Single-Sample Survey — `/questionnaire-info/:id` → `/questionnaire/:id`
**Description page** explains the four sections panelists will go through
(CATA, Intensity, Hedonic, Emotional) and gives a time estimate (10–15 min),
then **Start Survey** opens the actual form.

**Form** is a 6–7 step linear wizard:
1. Intro (skippable)
2. CATA — check all attributes you perceive
3. Intensity — rate (1–5) only the attributes you checked in step 2
4. Hedonic — likeability ratings (1–9): overall, appearance, aroma, flavor, texture
5. Emotional — intensity (1–5) across ~25 emotion words
6. Optional free-text comments
7. Review & submit

Auto-saves a draft to localStorage on every change; checks the database first
and reloads an already-submitted response (read-only) if the panelist already
completed it, preventing accidental double submission.

---

### 10. Multi-Sample Survey — `/multi-sample-info/:id` → `/multi-sample/:id`
**Description page** explains the blinded comparison protocol (sample codes,
palate cleansing, discrimination test, preference ranking).

**Form** repeats the CATA/Intensity/Hedonic/Emotional block per sample, with:
- A **30-second palate-cleanse countdown timer** between samples
- A **discrimination test** ("which sample is different?") if 3+ samples
- A **preference ranking** step (drag/order all samples best→worst)
- Final review & submit

This is the most involved survey type (15–25 minutes).

---

### 11. Concept Survey — `/concept-survey/:id`
**What it's for:** Panelists give feedback on a marketing concept (not a
physical sample).
**What you can do:** Browse the concept's marketing images (gallery with
prev/next), then answer the AI-generated questions inline (scale,
multiple-choice, ranking, open-text), with required-field validation, then
submit. Much shorter than the sensory surveys (5–10 minutes).

---

## Layout / navigation shell

**Main Layout** wraps every authenticated page:
- Top bar: brand, user info + role badge, logout, settings gear (admin only)
- Left sidebar (admin only): food-type selector, expandable list of import
  batches/projects within that food type, sample-type checkmarks
  (E-Tongue/GC-MS/Composition), data-integrity warnings
- A **Workflow Guide** stepper (newly added, and the thing that currently
  looks disjointed) appears at the top of Stage 1, Survey Analysis, Decision,
  and Concept Lab — a horizontal pill strip showing 6 stages (Import → Survey
  → Insights → Decide → Concept → Report) plus an "up next" banner.

---

## How the two tracks currently connect (and don't)

**R&D Track** (the "is this product good?" loop):
1. `/stage1` — import instrumental CSVs → creates an import batch
2. `/admin` — turn those samples into products/surveys, assign panelists
3. Panelists complete `/questionnaire` or `/multi-sample` surveys
4. `/survey-analysis` — admin reviews aggregated results vs. instrumental data
5. `/decision` — admin logs a GO/TWEAK/STOP call with full rationale
6. (GO only) → Commercialization Report Builder and/or seed a concept

**Marketing Track** (the "will people want this concept?" loop):
1. `/concept-testing` — build an AI-assisted concept survey (optionally seeded
   from a GO decision)
2. Panelists complete `/concept-survey`
3. `/survey-analysis` (Concept Tests tile) — admin reviews responses
4. (implied, not actually built) → write a final report

**The seams that feel disconnected today:**
- The "report" stage isn't really a page — both `/decision`'s
  Commercialization Report Builder and the vague "report" destination point
  back at `/decision`, so "write the report" doesn't have its own home.
- `/survey-analysis` crams three very different views (single-sample,
  multi-sample, concept-tests) behind one toggle, each with its own visual
  language — it doesn't read as one coherent "insights" experience.
- The new Workflow Guide stepper is bolted onto the top of four pages but
  doesn't reflect *real* progress (it can't tell if you've actually completed
  a step) — it's the same static strip everywhere, which is part of why it
  reads as disconnected/decorative rather than integrated.
- There's no single page that shows "this sample's whole journey" — instrumental
  data, survey results, decision, and concept-test results for the same sample
  live on four separate pages with different navigation patterns and color themes.
- Settings, while powerful, is a flat list of unrelated toggles with no
  indication of which ones matter for the workflow you're currently in.

---

## Notable design inconsistencies worth feeding to a redesign AI

- Color themes are assigned per-feature rather than per-meaning: orange/amber
  = Concept Lab, blue = primary actions/single-sample, purple = multi-sample,
  emerald = confirmed/success/GO. There's no unified system explaining *why*
  a color means what it means across pages.
- Some pages are wizards (Concept Lab, both survey forms), some are
  dashboards (Overview, Panelist Dashboard), some are dense control panels
  (Admin Config, Settings) — the navigational "shape" changes completely from
  page to page.
- Drafts are persisted via localStorage in two unrelated places
  (questionnaire forms, concept lab) with separate keys/conventions — not a
  shared pattern.
- The sidebar (food type + batch selector) only exists for admins and only
  applies to some pages, but it's always visible, including on pages where it
  does nothing.
