# Project Identity — Discovery (READ-ONLY)

Evidence gathered by reading `supabase/migrations/`, `src/app/`, and by running
SELECT-only queries against the **linked** Supabase project
(`golkgpeqenyqrcyawjdt` / "Sensory Platform") via `supabase db query --linked`.
No schema, data, or migrations were written.

> Note on terminology up front, because it matters for every answer: **there is
> no `projects` table.** "Project" in this codebase is an inferred/computed UI
> concept that maps 1:1 to an **active `import_batches` row**. Two unrelated SQL
> columns also happen to use the word "project" (`concept_tests.project_name`,
> `evidence_bundles.project_id`) and mean different things — detailed below.

---

# A. Schema reality

## A1. Tables related to each concept (exact SQL names)

All tables live in schema `public`. Exact `CREATE TABLE` names, by concept:

| Concept | Real table name(s) | Defined in |
|---|---|---|
| Import batches | `import_batches` | `20260604000000_food_intelligence_imports.sql:22` |
| Food types | `food_types` | `20260604000000_food_intelligence_imports.sql:3` |
| Samples | `instrumental_samples` (+ per-sample measurement tables `e_tongue_measurements`, `gcms_compounds`, `composition_profiles`) | `20260604000000_food_intelligence_imports.sql:37,48,59,69` |
| Sensory studies (panel) | `products` (the "study"), `responses` (panelist answers), `templates` | `20260602000000_initial_schema.sql:9,20,34` |
| Consumer / concept tests | `concept_tests`, `concept_responses` | `20260602000000_initial_schema.sql:41,57` |
| Concept image generation (Concept Lab) | `concept_generation_settings`, `concept_image_generations`, `concept_images` | `20260605000000_concept_lab_platform.sql:19,52,73` |
| Decisions | `decision_records` | `20260606000000_production_hardening.sql:191` |
| Reports | `commercialization_reports`, `evidence_bundles` | `20260606000005_commercialization_reports.sql:1`, `20260616000000_evidence_bundles.sql:1` |
| Import drop-zone queue | `pending_imports` | `20260618000000_pending_imports.sql:48` |
| Import column-mapping presets | `import_mapping_presets` | `20260606000004_import_mapping_presets.sql:1` |
| Tenancy | `organizations`, `org_email_domains` | `20260610000000_multi_tenancy_foundation.sql:37`, `20260612000000_company_email_domains.sql:52` |
| Audit | `audit_events` | `20260604000000_food_intelligence_imports.sql:82` |
| Misc | `profiles`, `workspace_settings` | `20260602000000_initial_schema.sql:1`, `20260606000000_production_hardening.sql:31` |

There is **no** `projects` table, no `samples` table (it is `instrumental_samples`),
no `studies` table (panel studies are `products`; consumer studies are
`concept_tests`), and no `reports` table (it is `commercialization_reports`).

## A2. Full column lists (types + nullability)

Columns reflect the original `CREATE TABLE` **plus** later `ALTER TABLE ... ADD COLUMN`.

### `food_types` (`20260604000000`, +org in `20260610000000`)
| column | type | nullable |
|---|---|---|
| id | uuid PK | not null |
| slug | text | not null (unique per-org / global, see A4) |
| label | text | not null |
| status | text CHECK in ('active','archived','deleted') | not null default 'active' |
| source | text CHECK in ('system','import','manual') | not null default 'import' |
| aliases | text[] | not null default '{}' |
| created_by | uuid → profiles(id) | nullable |
| created_at | timestamptz | not null default now() |
| updated_at | timestamptz | not null default now() |
| org_id | uuid → organizations(id) | nullable (NULL = global system row) |

### `import_batches` (`20260604000000`, +cols in `20260606000000`, `20260610000000`, `20260619000001`)
| column | type | nullable |
|---|---|---|
| id | uuid PK | not null |
| food_type_id | uuid → food_types(id) | not null |
| file_name | text | not null |
| status | text CHECK in ('active','archived','deleted') | not null default 'active' |
| row_count | integer | not null default 0 |
| recognized_columns | text[] | not null default '{}' |
| ignored_columns | text[] | not null default '{}' |
| detection_confidence | numeric | not null default 0 |
| imported_by | uuid → profiles(id) | nullable |
| imported_at | timestamptz | not null default now() |
| archived_at | timestamptz | nullable |
| deleted_at | timestamptz | nullable |
| idempotency_key | text | nullable (unique when present) |
| status_before_archive | text | nullable |
| org_id | uuid → organizations(id) | nullable (backfilled to default org) |
| reformulation_notes | text | nullable |

### `instrumental_samples` (`20260604000000`, +org `20260610000000`)
| column | type | nullable |
|---|---|---|
| id | uuid PK | not null |
| import_batch_id | uuid → import_batches(id) | not null |
| food_type_id | uuid → food_types(id) | not null |
| sample_id | text | not null (unique per (import_batch_id, sample_id)) |
| sample_name | text | nullable |
| category | text | nullable |
| created_at | timestamptz | not null default now() |
| org_id | uuid → organizations(id) | nullable |

### `e_tongue_measurements`
| id uuid PK not null; sample_id uuid → instrumental_samples(id) not null; sourness/bitterness/saltiness/umami/sweetness numeric not null default 0; created_at timestamptz not null default now() |

### `gcms_compounds`
| id uuid PK; sample_id uuid → instrumental_samples(id) not null; name text not null; concentration numeric not null default 0; aroma text not null default 'unknown'; threshold numeric not null default 0; created_at timestamptz not null default now() |

### `composition_profiles`
| id uuid PK; sample_id uuid → instrumental_samples(id) not null (UNIQUE); protein/fat/moisture/ph/salt_content/calcium_mg numeric not null default 0; created_at timestamptz not null default now() |

### `products` (panel study) (`20260602000000`, +cols `20260604000002`, `20260604000003`, `20260606000000`, `20260610000000`)
| column | type | nullable |
|---|---|---|
| id | uuid PK | not null |
| name | text | not null |
| category | text | not null default '' |
| status | text CHECK in ('draft','active','completed','archived') | not null default 'active' |
| custom_attributes | text[] | nullable default '{}' |
| is_multi_sample | boolean | not null default false |
| samples | jsonb | nullable |
| created_at | timestamptz | nullable default now() |
| assigned_panelist_ids | text[] | nullable default '{}' |
| source_import_batch_id | uuid → import_batches(id) | nullable |
| source_sample_id | text | nullable |
| status_before_archive | text | nullable (added in `20260606000000`) |
| org_id | uuid → organizations(id) | nullable |

### `responses`
| id uuid PK; user_id uuid → profiles(id) not null; product_id uuid → products(id) not null; run_number integer not null default 1; cata_attributes text[]; intensity_ratings/hedonic_scores/emotional_profile jsonb default '{}'; comments text nullable; created_at timestamptz; org_id uuid (added `20260610000000`). UNIQUE(user_id,product_id,run_number). (`20260603000000` adds the response jsonb columns.) |

### `concept_tests` (consumer study) (`20260602000000`, +cols `20260605000000`, +dims `20260619000000`, +org `20260610000000`)
| column | type | nullable |
|---|---|---|
| id | uuid PK | not null |
| name | text | not null |
| category | text | not null default '' |
| description | text | default '' |
| image_urls | text[] | default '{}' |
| target_market / price_point / key_benefits | text | default '' |
| questions | jsonb | not null default '[]' |
| panel_size | integer | not null default 50 |
| assigned_panelist_ids | text[] | default '{}' |
| status | text CHECK in ('draft','review','approved','active','completed','archived') | not null default 'active' |
| created_at | timestamptz | default now() |
| **project_name** | text | default 'Project 1' |
| food_type_slug | text | default '' |
| generated_image_ids | uuid[] | default '{}' |
| approval_notes | text | default '' |
| launched_at / archived_at | timestamptz | nullable |
| org_id | uuid → organizations(id) | nullable |
| (+ variant dimension columns from `20260619000000_concept_variant_dimensions.sql`) | | |

### `concept_responses`
| id uuid PK; user_id uuid → profiles(id) not null; concept_test_id uuid → concept_tests(id) not null; answers jsonb not null default '{}'; created_at timestamptz; org_id uuid. UNIQUE(user_id,concept_test_id). |

### `decision_records` (`20260606000000`, +lineage `20260619000001`, +org `20260610000000`)
| column | type | nullable |
|---|---|---|
| id | uuid PK | not null |
| sample_id | **text** | not null |
| sample_name | text | not null |
| decision | text CHECK in ('GO','TWEAK','STOP') | not null |
| issf_score | numeric CHECK 0–100 | not null |
| confidence | numeric CHECK 0–100 | not null |
| note | text | not null default '' |
| method_version | text | not null |
| decision_fingerprint | text | not null |
| created_by | uuid → profiles(id) | not null |
| created_at | timestamptz | not null default now() |
| parent_decision_id | uuid → decision_records(id) | nullable |
| org_id | uuid → organizations(id) | nullable |

### `commercialization_reports` (`20260606000005`, +evidence `20260616000000`, +branding/template, +org)
| column | type | nullable |
|---|---|---|
| id | uuid PK | not null |
| decision_record_id | uuid → decision_records(id) ON DELETE RESTRICT | not null |
| concept_test_id | uuid → concept_tests(id) ON DELETE RESTRICT | not null |
| packaging_image_id | uuid → concept_images(id) ON DELETE SET NULL | nullable |
| status | text CHECK in ('draft','review','approved','archived') | not null default 'draft' |
| version | integer CHECK >0 | not null default 1 |
| title | text | not null |
| report_snapshot | jsonb | not null |
| created_by | uuid → profiles(id) | not null |
| approved_by | uuid → profiles(id) | nullable |
| approved_at | timestamptz | nullable |
| created_at / updated_at | timestamptz | not null default now() |
| evidence_bundle_id | uuid → evidence_bundles(id) | nullable (added `20260616000000`) |
| org_id | uuid → organizations(id) | nullable |
| (+ report_branding `20260611000000`, report_template `20260612020000`) | | |
UNIQUE(decision_record_id, concept_test_id, version).

### `evidence_bundles` (`20260616000000`)
| column | type | nullable |
|---|---|---|
| id | uuid PK | not null |
| **project_id** | **text** | not null |
| version | integer CHECK >0 | not null |
| schema_version | text | not null |
| source_data_version | text | not null |
| payload | jsonb | not null |
| created_by | uuid → profiles(id) | not null |
| created_at | timestamptz | not null default now() |
| org_id | uuid → organizations(id) | nullable |
UNIQUE(project_id, version); UNIQUE(project_id, source_data_version).

### `pending_imports` (`20260618000000`)
| id uuid PK; org_id uuid → organizations(id) **not null**; storage_path text not null; file_name text not null; status text CHECK in ('pending','matched','ambiguous','failed','imported','dismissed') not null default 'pending'; matched_batch_id uuid → import_batches(id) nullable; parse_preview jsonb nullable; error_message text nullable; uploaded_by uuid → auth.users(id) nullable; created_at/updated_at timestamptz not null |

## A3. Foreign keys (target + nullability of the FK column)

| Table | FK column | → target | FK column nullable? | On delete |
|---|---|---|---|---|
| import_batches | food_type_id | food_types(id) | **not null** | CASCADE |
| import_batches | imported_by | profiles(id) | nullable | SET NULL |
| import_batches | org_id | organizations(id) | nullable | RESTRICT |
| instrumental_samples | import_batch_id | import_batches(id) | **not null** | CASCADE |
| instrumental_samples | food_type_id | food_types(id) | **not null** | CASCADE |
| instrumental_samples | org_id | organizations(id) | nullable | RESTRICT |
| e_tongue_measurements | sample_id | instrumental_samples(id) | **not null** | CASCADE |
| gcms_compounds | sample_id | instrumental_samples(id) | **not null** | CASCADE |
| composition_profiles | sample_id | instrumental_samples(id) | **not null** | CASCADE |
| food_types | created_by | profiles(id) | nullable | SET NULL |
| food_types | org_id | organizations(id) | nullable | RESTRICT |
| products | source_import_batch_id | import_batches(id) | **nullable** | SET NULL |
| products | org_id | organizations(id) | nullable | RESTRICT |
| (products.source_sample_id is **text**, no FK) | | | | |
| responses | user_id | profiles(id) | not null | CASCADE |
| responses | product_id | products(id) | not null | CASCADE |
| concept_tests | org_id | organizations(id) | nullable | RESTRICT |
| (concept_tests.food_type_slug is text, no FK) | | | | |
| concept_responses | user_id | profiles(id) | not null | CASCADE |
| concept_responses | concept_test_id | concept_tests(id) | not null | CASCADE |
| decision_records | created_by | profiles(id) | not null | RESTRICT |
| decision_records | parent_decision_id | decision_records(id) | nullable | SET NULL |
| decision_records | org_id | organizations(id) | nullable | RESTRICT |
| (decision_records.sample_id is **text**, NO FK to instrumental_samples) | | | | |
| commercialization_reports | decision_record_id | decision_records(id) | **not null** | RESTRICT |
| commercialization_reports | concept_test_id | concept_tests(id) | **not null** | RESTRICT |
| commercialization_reports | packaging_image_id | concept_images(id) | nullable | SET NULL |
| commercialization_reports | created_by | profiles(id) | not null | RESTRICT |
| commercialization_reports | approved_by | profiles(id) | nullable | RESTRICT |
| commercialization_reports | evidence_bundle_id | evidence_bundles(id) | nullable | RESTRICT |
| evidence_bundles | created_by | profiles(id) | not null | RESTRICT |
| evidence_bundles | org_id | organizations(id) | nullable | RESTRICT |
| (evidence_bundles.project_id is **text**, NO FK) | | | | |
| pending_imports | org_id | organizations(id) | not null | CASCADE |
| pending_imports | matched_batch_id | import_batches(id) | nullable | SET NULL |
| pending_imports | uploaded_by | auth.users(id) | nullable | SET NULL |

**Key takeaway:** the only hard FK chain into `import_batches` is
`instrumental_samples.import_batch_id` (NOT NULL) and the optional
`products.source_import_batch_id` / `pending_imports.matched_batch_id` (both
nullable). Decisions and reports do **not** carry a column that points at
`import_batches` — they link to a sample by **text `sample_id`** and to concepts.

## A4. Is there a `food_types` table, or is food type a field?

**Both exist, and they are used together:**

- There **is** a real `public.food_types` table (`20260604000000_food_intelligence_imports.sql:3`),
  with `slug`, `label`, `status`, `source`, `aliases`, `org_id`. Seeded with
  system rows `cheese` and `bread` (lines 211–215).
- `import_batches` and `instrumental_samples` reference it via a real FK
  `food_type_id uuid NOT NULL`.
- **But** several places store food type as **denormalized text** instead of the
  FK: `concept_tests.food_type_slug text` and `concept_image_generations.food_type_slug text`
  (`20260605000000:13,57`). App code (`computeProjectStatus`, `pickProjectName`)
  keys off this **slug string**, not the `food_type_id`.

Uniqueness is special-cased for tenancy (`20260610000000:170–174`): system rows
have `org_id IS NULL` and a global-unique slug (`uq_food_types_global_slug`);
tenant rows are unique per `(org_id, slug)` (`uq_food_types_org_slug`).

## A5. `grep -ri "project"` results and classification

Two greps were run: one over SQL/edge functions (the only places "project" could
be **data-backed**), and one over `src/` TS/TSX.

### Data-backed / schema "project" hits (SQL + edge functions) — pasted in full

```
supabase/migrations/20260605000000_concept_lab_platform.sql:1:-- Concept Lab platform layer: settings, project folders, generated image
supabase/migrations/20260605000000_concept_lab_platform.sql:12:  ADD COLUMN IF NOT EXISTS project_name text DEFAULT 'Project 1',
supabase/migrations/20260605000000_concept_lab_platform.sql:56:  project_name text DEFAULT 'Project 1',
supabase/migrations/20260605000000_concept_lab_platform.sql:90:CREATE INDEX ... idx_concept_tests_project ON public.concept_tests (project_name);
supabase/migrations/20260605000000_concept_lab_platform.sql:93:CREATE INDEX ... idx_concept_image_generations_project ON public.concept_image_generations (project_name);
supabase/migrations/20260611193000_reimport_deleted_instrumental_project.sql:2:-- project. Idempotency only suppresses retries...   (comment only)
supabase/migrations/20260616000000_evidence_bundles.sql:3:  project_id text NOT NULL,
supabase/migrations/20260616000000_evidence_bundles.sql:11:  UNIQUE (project_id, version),
supabase/migrations/20260616000000_evidence_bundles.sql:12:  UNIQUE (project_id, source_data_version)
supabase/migrations/20260616000000_evidence_bundles.sql:15-18: indexes on project_id
supabase/migrations/20260616000000_evidence_bundles.sql:52,71,72,78,88,94,98,107: create_evidence_bundle(target_project_id text...)
supabase/functions/generate-concept-images/index.ts:19,168,202,249,271: projectName / project_name (= concept_tests.project_name)
supabase/functions/process-import/index.ts:229,279: "match an existing active project by filename" (UI/log wording for an import batch)
supabase/functions/generate-report-narrative|notify-survey-assignment|run-report-agent: only "this Supabase project" (the Supabase project itself, unrelated)
```

Classification of the **only two real columns**:
- `concept_tests.project_name` (text, default `'Project 1'`) and the mirrored
  `concept_image_generations.project_name` — a **free-text label/folder name**
  for grouping concept images in the Concept Lab. It is **not** a grouping above
  `import_batches`; it is a label on a concept test, defaulting to "Project 1".
- `evidence_bundles.project_id` (text) — see A6; live values are sample IDs
  (`S4`, `S12`), i.e. it identifies a **single sample**, not a batch group.

### `src/` TS/TSX "project" hits — UI labels / variable names / component names (NO backing column)

~80 files match. None introduce a stored "project" entity; they all consume the
**computed** project concept (an active import batch). Notable ones:

- Logic: `src/app/lib/project-status.ts` (`pickProjectName`, `computeProjectStatus`),
  `src/app/lib/use-project-status.ts`, `src/app/lib/workflow/use-project-workflow.ts`,
  `src/app/lib/workflow/workflow-evaluator.ts`.
- Components: `project-command-center.tsx`, `project-header.tsx`, `project-card.tsx`,
  `project-journey-nav.tsx`, `project-metrics.tsx`, `project-status-badge.tsx`,
  `project-workflow-progress.tsx`, `overview-dashboard.tsx` (`ActiveProjects`),
  `main-layout.tsx` (sidebar "Project N" rows).
- `src/app/portfolio/*` — an **unrelated** personal-portfolio feature ("project
  chapters"); not part of the sensory platform data model.

Every one of these is a UI label or a variable/derived value. The single source
of the derived project name is `pickProjectName()` in `project-status.ts:103`,
which returns `batch.fileName` (sans `.csv`) or `"{FoodType} Project"`.

## A6. Any existing grouping concept ABOVE `import_batch`?

**No true parent-of-batch grouping exists.** What exists:

1. **`food_types`** sits *above* batches (one food type → many batches via
   `import_batches.food_type_id`). This is the closest real grouping, but it is a
   *category*, not a "project/client/brand".
2. **`products`** is a sibling/child derived *from* a batch
   (`products.source_import_batch_id`), not a parent.
3. **`concept_tests.project_name`** ('Project 1' default) is a free-text label on
   a concept test, **not** linked to any batch.
4. **`evidence_bundles.project_id`** (text) — despite the name, the live values
   are **sample IDs**. App code (`src/app/lib/report-evidence-source.ts:119,126`)
   calls `buildEvidenceBundle(projectId)` and resolves it via
   `dataset.eTongueData.find(item => item.sampleId === projectId)` — i.e.
   `project_id` == a single `instrumental_samples.sample_id`. Live values:
   `S4`, `S12` (see B/below). So this is a *sub*-batch identifier, not a super-batch group.

There is **no** `client`, `brand`, `client_project`, `batch_group`, or `campaign`
table anywhere in `supabase/migrations/`. The only super-batch isolation concept
is the tenant (`organizations` / `org_id`), which is far coarser than a project.

---

# B. Live data shape (SELECT-only, linked DB)

## B1. Total import batches

```
SELECT COUNT(*) FROM public.import_batches;  ->  15
```

## B2. Distinct food_type values + batch count per value

Food type is the FK `import_batches.food_type_id → food_types`. Counts:

```
slug            label            source  org_id                                batch_count
meat            Meat             import  11111111-...-111111111111             7
bread           Bread            system  NULL (global)                         3
yogurt          Yogurt           import  11111111-...-111111111111             3
cheese          Cheese           system  NULL (global)                         1
deletetesttype  Deletetesttype   import  11111111-...-111111111111             1
```

(5 distinct food types are actually attached to batches. `cheese`/`bread` are
seeded system globals; `meat`/`yogurt`/`deletetesttype` are tenant-created.)

## B3. Top-5 food types by batch count — sample rows

There are only 15 batches total, so the full per-batch listing is shown
(batch id, food_type, file_name, status, row_count, imported date):

```
id                                    food_type       file_name                status   rows  imported
43f874f2-6a90-4ffc-b7a8-94ce9a785d78  Bread           Bread                    deleted  12    2026-06-22
bfb38861-ca19-45b4-be5d-43d5f89e3681  Bread           Bread                    deleted  12    2026-06-22
99fc5e55-29d2-48f9-b4ca-83aa08b4c54e  Bread           Bread                    active   12    2026-06-22
0fdbce34-7dd9-409d-a0af-2e6269719ee6  Cheese          Cheese June              active   12    2026-06-16
170227f8-fa34-4279-a621-01736c7db867  Deletetesttype  tiny_test_import         deleted  2     2026-06-08
e62b0ad0-1fb7-4b37-a663-60a440092250  Meat            sample_plant_based_meat  deleted  12    2026-06-05
4b5aca4d-3950-4322-84db-28860b6fb48d  Meat            Import Test Batch        deleted  2     2026-06-08
b163e815-5522-426b-b223-c1375e5e71af  Meat            Verify Batch             deleted  2     2026-06-08
61de7ca3-2004-4c96-bf32-847860cfbbad  Meat            Final Check Batch        deleted  2     2026-06-08
836c71d3-1a36-44bf-a3d4-06b563428382  Meat            sample_plant_based_meat  deleted  12    2026-06-12
22e1469f-de37-4b83-a91d-2b3009946dc1  Meat            sample_plant_based_meat  deleted  12    2026-06-12
d6553351-058b-4152-8b4a-79c69dcbcc7a  Meat            Meat P1                  deleted  12    2026-06-12
0f9a568d-6df2-4989-b014-0ae16578f5b0  Yogurt          sample_yogurt_import     deleted  8     2026-06-05
055a78ba-2da2-4644-92b5-d77b8f26f577  Yogurt          sample_yogurt_import     deleted  8     2026-06-05
ef32ed6a-2ec0-4a66-8927-e18cdcffc491  Yogurt          sample_yogurt_import     deleted  8     2026-06-12
```

Only **2 batches are `active`**: Bread `99fc5e55…` and Cheese `0fdbce34…`
(plus all others `deleted`). `imported_by` for every batch is the same user
`f1b837d9-7406-4fb8-8b93-996f4e0d9352`; every row is org
`11111111-1111-1111-1111-111111111111` ("New Food Innovation"). This is a
single-tenant demo/dev dataset.

## B4. Downstream table totals + NULL-FK-back-to-import_batches counts

```
table                                 count
import_batches                        15
instrumental_samples                  126      (FK import_batch_id NOT NULL -> 0 null)
products                              81       (source_import_batch_id NULL -> 57)
responses                             288
concept_tests                         4
concept_responses                     2
decision_records                      15
commercialization_reports             25
evidence_bundles                      2
pending_imports                       0
```

NULL-FK detail (FKs that can point back to a batch):
- `instrumental_samples.import_batch_id` IS NULL → **0** (column is NOT NULL).
- `products.source_import_batch_id` IS NULL → **57 of 81** (70% of products are
  not linked to any import batch — these are mock/demo products).
- `decision_records` and `commercialization_reports` have **no column** that
  references `import_batches`, so "FK back to import_batches IS NULL" is not
  applicable. Their indirect link to a batch is via
  `decision_records.sample_id (text)` → `instrumental_samples.sample_id` →
  `import_batch_id`. Of 15 decisions, **14** have a `sample_id` that exists in
  `instrumental_samples`; **1** does not (it points at the reference/demo
  dataset that is not part of any import batch). All 25
  `commercialization_reports` have non-null `decision_record_id` and
  `concept_test_id` (0 null on either).

## B5. Import batches with ZERO rows in ANY downstream table (fully dead)

```
batches with no instrumental_samples AND no products  ->  1
```

That one batch is **`4b5aca4d-3950-4322-84db-28860b6fb48d` "Import Test Batch"**
(Meat, row_count 2, deleted) — it has 0 samples and 0 products and 0 decisions.
Every other batch has at least its `instrumental_samples` rows, so by the strict
"any downstream table" reading only this single batch is fully dead. (If
`instrumental_samples` is treated as part of the batch rather than "downstream,"
then the dead set widens to all 13 deleted batches that produced no products and
no decisions — see B3/the counts below in B6.)

## B6. 10 batches with the LEAST obvious project grouping (+ linked counts)

The batches hardest to assign to a distinct "project" are the **Meat** and
**Yogurt** ones, because many share the *same* `file_name` across *different*
import dates (re-imports of the same demo CSV), and the `deletetesttype` /
"Verify"/"Final Check" batches are clearly throwaway test imports. Full rows with
linked sample/product/decision counts:

```
id                                    food_type  file_name                rows  conf  imported               status   samples products decisions
e62b0ad0-...-60a440092250             Meat       sample_plant_based_meat  12    0.98  2026-06-05 16:00       deleted  12      0        0
836c71d3-...-06b563428382             Meat       sample_plant_based_meat  12    0.98  2026-06-12 20:14       deleted  12      0        0
22e1469f-...-2b3009946dc1             Meat       sample_plant_based_meat  12    0.98  2026-06-12 20:26       deleted  12      0        0
d6553351-...-79c69dcbcc7a             Meat       Meat P1                  12    0.98  2026-06-12 21:11       deleted  12      0        0
4b5aca4d-...-28860b6fb48d             Meat       Import Test Batch        2     0.89  2026-06-08 02:34       deleted  0       0        0
b163e815-...-c1375e5e71af             Meat       Verify Batch             2     0.89  2026-06-08 02:44       deleted  2       0        0
61de7ca3-...-847860cfbbad             Meat       Final Check Batch        2     0.89  2026-06-08 02:48       deleted  2       0        0
170227f8-...-01736c7db867             Deletetesttype tiny_test_import     2     0.88  2026-06-08 03:37       deleted  2       0        0
0f9a568d-...-0ae16578f5b0             Yogurt     sample_yogurt_import     8     0.98  2026-06-05 22:55       deleted  8       0        0
055a78ba-...-d77b8f26f577             Yogurt     sample_yogurt_import     8     0.98  2026-06-05 23:01       deleted  8       0        0
ef32ed6a-...-e18cdcffc491             Yogurt     sample_yogurt_import     8     0.98  2026-06-12 20:15       deleted  8       0        0
```

Observations grounding "least obvious": three Meat batches and three Yogurt
batches carry **identical file_names** (`sample_plant_based_meat`,
`sample_yogurt_import`) but were imported on different dates — there is nothing
in the row to tell whether they are the same project re-run or different
projects. None of these has any product or decision linked (all are dead demo
imports). Three Meat batches even share the **same `idempotency_key`**
`7bc8ea8ad727…` (`e62b0ad0`-derived family), indicating literal re-imports of the
same source file. `reformulation_notes` is NULL on every batch, so the
retest-lineage field that *would* disambiguate is unused.

## B7. 5 food types with multiple batches — same project re-run vs unrelated one-offs?

Only **3** food types have more than one batch (`meat`=7, `bread`=3, `yogurt`=3);
the prompt's "5" cannot be satisfied — `cheese` and `deletetesttype` have a
single batch each. For the three that qualify, the raw sample rows show:

- **Bread (3 batches, all file_name "Bread", all 2026-06-22):** All three batches
  contain the **identical 12 samples** (`B1 Sourdough Loaf v1.0`, `B2 White
  Sandwich Bread v2.1`, … `B12 Enriched White v3.1`). Two are `deleted`, one
  `active`. → **Same project imported repeatedly** (delete/re-import churn), not
  distinct projects.
- **Yogurt (3 batches, all "sample_yogurt_import", 8 samples each):** identical
  file/sample shape across 2026-06-05 and 2026-06-12. → **Same demo file re-run.**
- **Meat (7 batches):** a mix — three are the same `sample_plant_based_meat` file
  (samples `M1..M12`, categories Pea Protein Burger / Soy Mince / Mycoprotein /
  Lentil Patty / Jackfruit Based), one renamed copy `Meat P1` (same M1..M12),
  plus tiny QA imports `Verify Batch` (V1/V2 "Verify Burger A/B"), `Final Check
  Batch` (F1/F2 "Final Check Burger A/B"). → **One real demo dataset re-imported
  several times + several throwaway smoke-test batches**, not seven independent
  meat projects.

Raw evidence (sample-level, abbreviated):
```
Bread  / Bread                   / B1  Sourdough Loaf v1.0 / B2 White Sandwich Bread v2.1 / ... / B12 Enriched White v3.1   (repeats across all 3 batches)
Meat   / sample_plant_based_meat / M1..M12  (Pea Protein Burger, Soy Mince, Mycoprotein, Lentil Patty, Jackfruit Based)     (repeats across 3 batches + Meat P1)
Meat   / Verify Batch            / V1 Verify Burger A, V2 Verify Burger B
Meat   / Final Check Batch       / F1 Final Check Burger A, F2 Final Check Burger B
Yogurt / sample_yogurt_import    / 8 samples  (repeats across 3 batches)
```

Conclusion from the data: batches within a food type here are **the same project
re-imported**, not naturally-distinct projects that happen to share a food type.

---

# C. App / UI reality

## C1. Where "project" is inferred/computed for display

The single source of the derived project identity is **`pickProjectName()`** in
[src/app/lib/project-status.ts:103-109](src/app/lib/project-status.ts#L103-L109):

```ts
function pickProjectName(input: ComputeProjectStatusInput): string {
  const batch = input.importBatchId
    ? input.importBatches.find(b => b.id === input.importBatchId)
    : input.importBatches.find(b => b.foodTypeSlug === input.foodType && b.status === 'active');
  if (batch) return batch.fileName.replace(/\.csv$/i, '');
  return `${formatFoodTypeLabel(input.foodType)} Project`;
}
```

It is invoked inside `computeProjectStatus()` (same file, line 122), which also
derives the full workflow state (stages, decision, report status, next action).
That function is bundled by the hook
[src/app/lib/use-project-status.ts](src/app/lib/use-project-status.ts) as
`useProjectStatus(foodType, importBatchId)` and `useProjectStatusList()` (one
entry per **active** batch — `use-project-status.ts:61-71`).

A parallel workflow inference also exists in
[src/app/lib/workflow/use-project-workflow.ts](src/app/lib/workflow/use-project-workflow.ts)
+ `workflow/workflow-evaluator.ts`, used by the Project Command Center.

## C2. One shared function, or duplicated/divergent "what project is this" logic?

**The *naming/status* computation is centralized** (`computeProjectStatus` /
`pickProjectName`), consumed by every page via `useProjectStatus`. Call sites:

- [main-layout.tsx:89](src/app/components/main-layout.tsx#L89)
- [project-header.tsx:20](src/app/components/project-header.tsx#L20)
- [survey-analysis.tsx:86](src/app/components/survey-analysis.tsx#L86)
- [commercialization-report-page.tsx:55](src/app/components/commercialization-report-page.tsx#L55)
- [overview-dashboard.tsx:199](src/app/components/overview-dashboard.tsx#L199) (via `useProjectStatusList`)

**However, the "which batch am I scoped to" decode IS duplicated/divergent.** The
`subCategory` string is parsed with the same ad-hoc `batch:` prefix logic in at
least four places:

- `main-layout.tsx:57` — `subCategory?.startsWith('batch:') ? subCategory.replace('batch:','') : null`
- `main-layout.tsx:373` (a second copy in the same file)
- `project-header.tsx:19` — same expression
- `stage4-enhanced.tsx:47` — same expression

…while the Project Command Center instead reads the batch from the **route param**
`useParams<{ batchId }>()` ([project-command-center.tsx:182](src/app/components/project-command-center.tsx#L182))
and runs a *different* workflow engine (`useProjectWorkflow`). So there are two
divergent notions of "current batch/project": the in-memory `subCategory` selection
and the `/project/:batchId` URL param, reconciled ad hoc in
`project-command-center.tsx:193-206`.

## C3. What the sidebar renders re: scope/context; any "current X" header?

The sidebar is [src/app/components/main-layout.tsx](src/app/components/main-layout.tsx).
It renders a **"Food Type"** list (header literally `Food Type`, line 120). Each
food type row can expand into its batches, rendered as **"Project N: {fileName}"**
([main-layout.tsx:184](src/app/components/main-layout.tsx#L184)) — i.e. the
sidebar's unit of scope is food type → batch, labeled "Project N". Selecting a
food type/project calls `setSelection(ft, 'batch:'+id)` (lines 146, 180).

Below the list is a **context panel** showing the active type label, machine
sample count, survey count, and "Last import: {date}" for the selected batch
(lines 255–283) — this is the closest thing to a "current scope" header in the
chrome.

A dedicated **"current project" header bar** also exists:
[src/app/components/project-header.tsx](src/app/components/project-header.tsx)
— the `ProjectHeader` card shows `status.projectName` (linked to `/project`), a
status badge, the journey nav, and the next-action button. It is shown across the
admin workflow pages. So yes, a persistent "current project" header already
exists, driven entirely by the computed `useProjectStatus`.

## C4. Batch-scoped routing — is there a `[batchId]`/dynamic segment?

Yes. From [src/app/routes.tsx](src/app/routes.tsx):
- `{ path: "project", Component: ProjectCommandCenter }` (line 85)
- `{ path: "project/:batchId", Component: ProjectCommandCenter }` (line 86) ← the
  only batch-scoped dynamic route.

`ProjectCommandCenter` reads it via `useParams<{ batchId }>()`
([project-command-center.tsx:182](src/app/components/project-command-center.tsx#L182)).
Other workflow pages (`/stage1`, `/survey-analysis`, `/decision`,
`/concept-testing`, `/report`) are **not** parameterized by batch — they rely on
the in-memory `FoodTypeContext` selection instead. Other dynamic segments are
sample/study-scoped, not batch-scoped: `concept-survey/:conceptId`,
`questionnaire-info/:productId`, `questionnaire/:productId`,
`multi-sample-info/:productId`, `multi-sample/:productId`.

## C5. Existing "current selected X" state a "current project" could reuse?

Yes — there is an in-memory selection context, **`FoodTypeContext`**, in
[src/app/contexts/food-type-context.tsx](src/app/contexts/food-type-context.tsx):

```ts
const [foodType, setFoodType] = useState<FoodType>('cheese');   // line 67
const [subCategory, setSubCategory] = useState<string | null>(null);  // line 68
const setSelection = (ft, sub = null) => { setFoodType(ft); setSubCategory(sub); };  // line 105
```

The current "selected project" is encoded as `foodType` + `subCategory =
'batch:<import_batch_id>'`. Characteristics:

- It is **React state only** — *not* persisted to URL, cookie, localStorage, or
  any DB column on a user/session table. (The only `localStorage` use in
  `main-layout.tsx:430-444` is an unrelated one-time bread/cheese cleanup flag.)
- It resets to `'cheese'` on reload and auto-falls-back to the first active food
  type if the current one disappears (`food-type-context.tsx:87-92`).
- The `/project/:batchId` route param is the *only* place batch selection touches
  the URL, and it is not wired back into `FoodTypeContext`.

So a real "current project" selection could **reuse `FoodTypeContext.subCategory`**
(already a batch pointer) but would be **net-new** if persistence (URL/cookie/DB)
is required — none exists today.

---

# D. Constraints check

## D1. Supabase client lib + migration tooling

- Client library: **`@supabase/supabase-js` `^2.107.0`** (`package.json:46`).
- Migration tooling: **Supabase CLI** (installed `v2.90.0` at
  `/opt/homebrew/bin/supabase`; project linked to ref `golkgpeqenyqrcyawjdt`).
  Migrations are plain SQL files under `supabase/migrations/`. Types are
  generated via `supabase gen types typescript --linked` (`package.json:14`
  `db:types` script) into `src/app/lib/db/database.types.ts`.
- Edge functions live under `supabase/functions/` (Deno):
  `process-import`, `aggregate-scores`, `run-report-agent`,
  `generate-report-narrative`, `generate-concept-images`,
  `notify-survey-assignment`, `drive-sync`, `_shared`.

## D2. Do tables use RLS? Representative policy

Yes — RLS is enabled and heavily used on every domain table. The pattern is a
permissive role/status policy AND-ed with an additive **`AS RESTRICTIVE`** org
isolation policy.

Representative permissive policy ([20260604000000:120-129](supabase/migrations/20260604000000_food_intelligence_imports.sql#L120-L129)):
```sql
CREATE POLICY import_batches_select_authenticated ON public.import_batches
  FOR SELECT TO authenticated
  USING (status = 'active' OR is_admin());

CREATE POLICY import_batches_admin_all ON public.import_batches
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());
```

Representative tenant-isolation policy (auto-applied to all tenant tables via the
`DO $$ … $$` loop, [20260610000000:142-147](supabase/migrations/20260610000000_multi_tenancy_foundation.sql#L142-L147)):
```sql
CREATE POLICY org_isolation ON public.<table> AS RESTRICTIVE FOR ALL TO authenticated
  USING (org_id = public.current_org_id())
  WITH CHECK (org_id = public.current_org_id());
```

A **new `projects` table would need to follow this exact two-layer pattern**:
(1) a permissive admin/role policy, (2) an `AS RESTRICTIVE` `org_isolation`
policy on `org_id = public.current_org_id()`, plus a `BEFORE INSERT` trigger
`public.set_org_id()` to auto-stamp `org_id`. Helper functions available:
`public.is_admin()`, `public.is_active_user()`, `public.current_org_id()`,
`public.set_org_id()`.

## D3. Migration file naming convention

Files are `supabase/migrations/<UTC-ish timestamp>_<snake_case_description>.sql`.
Two timestamp widths appear in history:

- 14-digit `YYYYMMDDHHMMSS` (most recent files), e.g.
  `20260616000000_evidence_bundles.sql`, `20260618000000_pending_imports.sql`,
  `20260619000001_product_lineage.sql`.
- Early files use a 14-digit form too but with a low-entropy sequence suffix,
  e.g. `20260602000000_initial_schema.sql`, `20260602000001_rls_policies.sql`,
  `20260604000003_product_import_sources.sql`.

The latest migration is `20260620000000_drive_sync.sql`. A new migration should
therefore be named with a UTC timestamp strictly greater than `20260620000000`,
14 digits, snake_case description — e.g. `20260625000000_projects.sql` — to sort
last without renumbering anything.

---

*End of discovery. No schema proposed, no groupings assigned to ambiguous
batches, no migration written — per instructions.*
