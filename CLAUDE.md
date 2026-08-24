# Claude Code guide

Read `AGENTS.md` before changing this repository. It is the authoritative source
for product context, schema policy, generated-type rules, and GO/TWEAK/STOP
governance.

## Project shape

- React 18 + Vite + React Router; this is not a Next.js application.
- Supabase owns authentication, application data, storage, Edge Functions, and
  Row Level Security.
- The product journey is Data → Studies → Responses → Insights → Decision →
  Concept → Report.
- `projects` is the source of truth for project identity.
- A confirmed GO is required before Concept Lab or report work.

## Non-negotiable data rules

- Never hand-edit `src/app/lib/db/database.types.ts`.
- Inspect the linked live schema before any migration.
- If schema, migrations, generated types, and app expectations disagree, stop
  and report the mismatch before making a fix.
- Regenerate types and run the schema/type CI gate after a migration.
- Never commit personal, client, or production credentials, `.env` files,
  client evidence, or panelist data. The public synthetic accounts documented
  in `DEMO_INSTRUCTIONS.md` are the only credential exception.

## Verification

Use the repository scripts and report exactly what ran:

```bash
npx pnpm@10 run check:runtime
npx pnpm@10 run typecheck
npx pnpm@10 run lint
npx pnpm@10 run test:coverage
npx pnpm@10 run build
```

Run `test:rls:local` for authorization or data-access changes and `test:e2e` for
user-facing workflow changes. Project-specific evaluation contracts live in
`agent-system/`; reusable product-review roles live in `agents/platform/`.
