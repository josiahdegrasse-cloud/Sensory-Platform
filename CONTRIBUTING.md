# Contributing

## Schema & deploy ordering (read this before merging a migration)

On 2026-06-25 a production outage was caused by a migration reaching the
database **before** the app code that depended on it (column renames were
applied to prod while the old app code was still live). Two guards exist to make
that ordering mistake structurally hard to repeat. They are intentionally
narrow — ordering enforcement only, not a CD redesign.

### Guard 1 — CI fails if prod schema is ahead of your branch (ACTIVE)

CI (`.github/workflows/ci.yml`, step "Check migration drift") runs
`scripts/check-migration-drift.sh`, which fails the build if any migration is
**applied on the linked Supabase project but missing from your branch's
`supabase/migrations/`**. That is the exact shape of the outage: prod schema
ahead of the code. The reverse — local migrations not yet applied to prod — is
the normal pre-deploy state and is allowed.

- **To activate it**, add a repository secret `SUPABASE_ACCESS_TOKEN`
  (Settings → Secrets and variables → Actions). Until then the step **skips with
  a warning** rather than failing, so it can't block unrelated PRs.
- **If it fails**, a migration was applied to prod that isn't in your branch.
  Pull the missing migration file in (or revert the remote change) before
  merging.
- Test the parser locally without a network call:
  ```
  CHECK_MIGRATION_DRIFT_FIXTURE=some-migration-list-output.txt \
    bash scripts/check-migration-drift.sh
  ```

### Guard 2 — migrations apply on the production build, before deploy (READY, NOT YET ENABLED)

`scripts/vercel-build.sh` applies pending migrations (`supabase db push --linked`)
**before** building the app, but only for **production** Vercel builds. This makes
"merge to main" the single trigger for both schema and code, instead of a human
running `supabase db push` out-of-band. A failed migration fails the build, so a
mismatched bundle is never served.

It ships **dormant** — nothing changes until you deliberately enable it, because
a bad production `buildCommand` breaks every deploy and this could not be tested
against a real Vercel build from the dev environment.

**To enable (do this with eyes on one deploy):**

1. In Vercel project settings, add **Production** environment variables:
   - `SUPABASE_ACCESS_TOKEN` (required)
   - `SUPABASE_DB_PASSWORD` (add this if the first deploy shows `db push` failing
     to connect — fresh build envs have no cached DB credential)
2. Change `vercel.json` `buildCommand` from `pnpm run build` to
   `bash scripts/vercel-build.sh`.
3. Trigger one production deploy and **watch the build log**: confirm the
   migration step runs and the build succeeds before relying on it. Preview/branch
   deploys are unaffected (the script only migrates when `VERCEL_ENV=production`).

> **Mental-model change once enabled:** merging a migration to `main` applies it
> to the production database automatically, as part of that merge's deploy. You
> no longer run `supabase db push` by hand. Plan rename/destructive migrations as
> expand-then-contract so old and new code each tolerate the schema during the
> brief deploy window — automatic rollback is **not** part of this (out of scope).

## Local checks before opening a PR

CI runs typecheck, lint, tests, browser smoke tests, a prod-dependency audit, and
the build. Run the fast ones locally first (this repo pins pnpm 10; if your local
pnpm differs, call the binaries directly to avoid a lockfile mismatch):

```
./node_modules/.bin/tsc --noEmit
./node_modules/.bin/vitest run
./node_modules/.bin/vite build
```

## Migrations

- New migration files go in `supabase/migrations/` using the existing
  `YYYYMMDDHHMMSS_snake_case.sql` naming (timestamp strictly after the latest
  file so it sorts last).
- After writing a migration, regenerate types so app code stays in sync with the
  schema: `npm run db:types` (writes `src/app/lib/db/database.types.ts`).
- Never apply a migration to production manually ahead of merging the code that
  depends on it — that is the failure Guards 1 and 2 exist to prevent.
