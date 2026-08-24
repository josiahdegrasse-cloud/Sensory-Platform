# Evidence Assist

Evidence Assist is the controlled evidence layer between retrieval and client-facing report prose. It lets the existing RAG service find useful material while preventing raw chunks, file paths, internal source names, or over-broad claims from reaching the report writer.

## Mental model

Think of the feature as an evidence airlock:

1. The dashboard submits the current project context. The RAG service treats it as a request hint, resolves the project, sample, decision, food type, and ISSF against the tenant-scoped production database, and marks project evidence verified only after that lookup succeeds.
2. The existing RAG hybrid search retrieves candidate literature. Evidence Assist does not introduce a second vector store.
3. Only literature explicitly approved for scientific use and cleared for licensing can proceed. Pending, rejected, or rights-unclear documents fail closed.
4. A deterministic classifier assigns each candidate a source type, intended use, claim permission, confidence, limitations, and explicit `doesNotSupport` boundaries.
5. Low-relevance, duplicate, category-mismatched, unsafe, or unclassifiable candidates are rejected with a reason.
6. Internal `EvidenceCard` records retain traceability fields for reviewers.
7. A one-way projection creates `ReportSafeEvidenceCard` records. This type cannot contain source titles, paths, chunks, excerpts, notes, retrieval scores, or backend identifiers.
8. The report-writing model receives only verified project facts plus each safe card's ID and `safeReportLanguage`. Runtime guards reject forbidden fields before generation. The complete report-safe card remains available to deterministic code and the saved snapshot.
9. Pre-render and rendered-PDF QC scan for internal terminology, paths, backend names, raw retrieval language, suspicious raw decimal leakage, and copied excerpts.

## Claim policy

- Project evidence may support product-specific statements only after the service verifies it against the authenticated tenant's database record.
- External literature supplies scientific context, method guidance, validation guidance, or claims-governance guidance. It does not prove preference, demand, readiness, or superiority for this product.
- A concept sample below 30 is directional. Preference, purchase-intent, price, demand, and packaging claims stay blocked.
- A valid product `GO` remains `GO`; incomplete consumer, packaging, claims, or approval work restricts external wording rather than silently downgrading the product decision.

## Main contracts

The frontend contract and policy are in `src/app/lib/evidence-assist/`. The backend classifier and projection are in the RAG service's `rag_food/evidence_assist.py`.

The schema version is `evidence-assist.v1`. Both sides fail closed on an unknown version or an unsafe card shape.

Important rule: report-writing code must use `ReportSafeEvidenceCard`, never `EvidenceCard`.

## Surfaces

- `POST /api/evidence-assist` provides the direct controlled-evidence API.
- TWEAK diagnosis includes an `evidenceAssist` result alongside its existing response.
- The commercialization-report builder retrieves up to three approved, category-relevant literature cards before writing. The administrator reviews the selected source titles, then the on-device writer receives only the report-safe projection.
- Saved report versions retain the safe guidance cards, a minimal approved-source citation record, and a protected locator used by the authenticated article viewer. Raw excerpts, chunk IDs, retrieval scores, and internal notes are discarded before persistence; the locator is never printed in the report.
- PDF generation and QC understand the safe-card contract and retain compatibility with older snapshots.

## Trust boundary and access control

- Dashboard calls use the active Supabase access token as a bearer token. The RAG service validates issuer, audience, signature, expiry, subject, tenant, and role.
- Evidence Assist and TWEAK generation require `researcher` or `admin`; library scan, ingestion, and review require `admin`.
- The browser cannot assert that project evidence is verified. The server resets that marker and re-resolves canonical project facts before evidence or report generation.
- Source documents are opened through an authenticated fetch and a temporary browser blob, so access tokens are not placed in URLs.
- `VITE_NFI_RAG_URL` is required in production. Localhost fallback exists only in development and tests.

## Corpus governance

The publication source directory is server-controlled through `NFI_PUBLICATIONS_SOURCE_PATH`; the browser cannot submit arbitrary filesystem paths. Every indexed document starts as `pending`. An administrator records scientific-review status, usage-rights status, reviewer identity, timestamp, and notes. Approval is allowed only after the peer-review field is resolved and rights are marked `cleared`. Retrieval filters out anything not approved.

## Rollout

Set `NFI_EVIDENCE_ASSIST_REPORT_MODE` in the RAG service:

- `shadow`: classify evidence and emit metrics, but do not let cards influence professional-report prose.
- `enforce`: pass the safe projection to the professional-report writer and use it in report guidance.

`shadow` is the default. Promote to `enforce` only after staging metrics, category-mismatch results, citation review, and report leakage checks meet the agreed release threshold.

The direct Evidence Assist and TWEAK APIs return their explicit Evidence Assist results in either mode. The dashboard report builder uses the direct, review-before-writing path; the rollout setting continues to control the RAG service's legacy embedded professional-report path.

Prometheus metrics expose run counts, accepted cards by source type, rejection reasons, and QC warning counts. They intentionally contain no titles, paths, excerpts, product names, or other source content.

## Verification

From the dashboard repository:

```bash
pnpm typecheck
pnpm test
pnpm build
```

From the RAG service repository:

```bash
.venv/bin/python -m pytest
```

The tests cover authentication and role boundaries, canonical-context
replacement, category mismatch, corpus approval, classification boundaries,
GO preservation, safe projection, writer-packet isolation, leakage scanning,
endpoint integration, report orchestration, and PDF quality checks.
