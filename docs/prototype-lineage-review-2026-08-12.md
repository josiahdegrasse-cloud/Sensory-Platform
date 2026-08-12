# Prototype lineage review — 12 August 2026

Twenty historical records were reviewed against the live tenant-scoped schema,
instrumental samples, evidence bundles, decisions, concepts, and saved reports.
Live migrations matched the repository and generated database types matched the
live schema before and after repair.

## Proven and repaired

- Two Coconut Cheddar v3.0 decision records (`S4`) referenced the same current
  evidence bundle. That bundle proved one project and one instrumental sample.
- The archived VitaCheese concept created on 22 June was referenced only by
  reports tied to one GO decision.
- The Cashew Cream Cheese v2.0 concept was referenced only by reports tied to
  one GO decision.

Migration `20260812000000_reconcile_proven_legacy_lineage.sql` applied those four
repairs and asserts that they leave the reconciliation view.

## Reviewed and intentionally unresolved

- Twelve legacy `M1`–`M12` studies have no project or source-batch identity.
  Each sample label matches four old instrumental imports, so selecting one
  would fabricate lineage.
- Dairy Control 1 (`D1`) has no matching instrumental sample or project record.
- Three older VitaCheese concepts have no single authoritative decision path.
  One has no report linkage; the others have report history spanning multiple
  decisions.

These sixteen records remain visible in the reconciliation queue by design.
They should be linked only if original batch manifests or contemporaneous
project records become available. They are not active-project failures.
