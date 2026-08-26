# Sensory Platform operations runbook

## Branded tenant setup

Before a public domain exists, run the Vite app and use `http://<tenant>.localhost:<port>`.
The seeded Fermiq workspace is available at `http://fermiq.localhost:5173` when Vite uses its
default port. A shared preview can select the same public branding with `?tenant=fermiq`; this is
only a brand/routing hint, and authenticated access still has to match the protected organization
record. Use the generated tenant URL so the hint is preserved until wildcard DNS is connected.

1. Point the wildcard DNS record `*.your-root-domain.com` at the frontend host and add the wildcard domain to the hosting project.
2. Set `VITE_ROOT_DOMAIN=your-root-domain.com` on the frontend deployment.
3. Add the apex and wildcard tenant callback pattern to the Supabase Auth redirect allowlist. Google OAuth and password recovery intentionally return to the originating tenant host.
4. Sign in as an explicitly seeded platform operator, open **Settings → Clients**, and create the customer workspace.
5. Send the generated tenant URL to the designated first administrator. They must create the account with the exact email entered during onboarding; the one-use database grant promotes that account and is then consumed.
6. Confirm that the customer logo, colors, workspace name, and sign-in page resolve on the tenant hostname.

The shared apex remains a neutral workspace. A signed-in user on a branded subdomain is rejected unless the hostname slug matches the organization slug loaded from the protected database record.

## Release health check

Before promoting a release:

1. Run `pnpm run db:types`, `pnpm run test:migration-drift`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
2. Open **Settings → Operations** and refresh the checks.
3. Confirm Supabase connectivity, zero unexpected failed imports, and review every unresolved prototype-lineage item.
4. Confirm Evidence Assist is online, its document/chunk totals are plausible, and literature ingestion has no unexplained errors.
5. Check concept-image spend against the tenant cap. The image Edge Function enforces the effective monthly cap server-side.

The supported release runtime is Node 22.13 through Node 24 with pnpm 10. Run
`pnpm check:runtime` before release work; CI enforces the same baseline and
`.nvmrc` selects the canonical Node version. A successful release record should
include the commit SHA, CI run, frontend deployment identifier, research API
deployment identifier, schema drift result, tenant-isolation result, dependency
audit result, and the operator who approved promotion.
Use the [release evidence template](release-evidence-template.md) to keep that
record complete and consistent.

Application crashes and route-render failures are sent to Sentry only when
`VITE_SENTRY_DSN` is configured. Reports carry a low-cardinality boundary tag;
default personally identifiable information remains disabled. Confirm the
release identifier and source maps in a preview error before production
promotion.

## Backup and recovery

The dashboard must not claim a backup exists merely because the application is healthy. Verify these provider controls directly:

- **Supabase:** confirm the project plan’s backup retention and point-in-time recovery window. Record the date and operator in the release ticket. Run a restore into a separate preview project at least quarterly and verify tenant RLS, generated schema types, object storage references, and a representative project workflow.
- **Tenant-isolation CI:** `pnpm test:rls:local` starts a disposable local Supabase stack, applies the complete migration history, signs in administrators from two organizations, and proves that rows and aggregate RPCs cannot cross tenant boundaries. GitHub Actions runs this without production credentials and fails if the stack or required test environment is unavailable.
- **Vercel research API:** keep all required environment-variable names documented, never their secret values. Retain the last known-good deployment. Exercise rollback to that deployment and verify `/health/ready`, `/api/status`, and one authenticated retrieval request at least quarterly.
- **Vercel frontend:** retain the last known-good deployment and confirm wildcard DNS/certificates after rollback.

## Incident rollback

1. Stop new imports and AI generation if data integrity or unexpected spend is suspected.
2. Roll the Vercel frontend and research API projects back to their last known-good deployments.
3. Do not reverse an applied database migration destructively. Ship a forward-only corrective migration after comparing the live schema with generated `database.types.ts`.
4. Re-run tenant isolation, prototype lineage, decision-gate, and report-quality tests before restoring normal operation.
5. Preserve request IDs, audit events, failed import records, and generation error messages for the incident review.

## External drills still requiring an operator

These checks cannot be truthfully automated from the frontend repository:

- Quarterly Supabase restore into an isolated project and verification of RLS,
  storage references, and a representative workflow.
- Quarterly Vercel frontend and research-service rollback to known-good
  deployments, followed by authenticated health and retrieval checks.
- DNS and TLS verification for the apex and tenant wildcard after a rollback.
- Sentry alert destination, retention, and escalation-policy review.

Record the evidence and date for each drill in the release or incident ticket.
