# Sensory Analysis Dashboard (NFI Platform)

A Supabase-backed platform for food R&D and product development. It takes a product
from lab to market by combining three tracks into one workflow, organized by **food type**
(cheese, bread, or any custom type an admin adds):

1. **Instrumental** — objective machine measurements (E-Tongue, GC-O/GC-MS, composition).
2. **Sensory panel** — semi-trained panelist questionnaires (CATA, intensity, hedonic, EsSense25 emotion).
3. **Consumer concept testing** — AI-assisted concept surveys and imagery for market validation.

Results feed an **Integrated Sensory Screening Framework (ISSF)** decision engine that produces a
**GO / TWEAK / STOP** recommendation per food type.

## Tech stack

- **Frontend:** React 19 + Vite 6, TypeScript, React Router 7 (data router, lazy routes)
- **Server state:** TanStack Query
- **UI:** Tailwind CSS 4 + Radix UI primitives (shadcn-style components in `src/app/components/ui`)
- **Backend:** Supabase (Postgres + Auth + Row Level Security + Storage + Edge Functions)
- **Errors:** Sentry
- **Tests:** Vitest (unit), Playwright (e2e)

## Prerequisites

- Node 20
- pnpm 10 (`corepack enable` or `npx pnpm@10`)
- A Supabase project (URL + anon key)

## Setup

```bash
pnpm install
cp .env.example .env   # then fill in your Supabase values
```

Required environment variables (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon (public) key — RLS is the real access gate |
| `VITE_ROOT_DOMAIN` | Canonical apex used to resolve and enforce branded tenant subdomains |
| `VITE_NFI_RAG_URL` | Authenticated Vercel Evidence Assist API URL; required in production |
| `SENTRY_AUTH_TOKEN` / `SENTRY_DSN` | Optional; only for source-map upload in CI |

## Scripts

```bash
pnpm dev          # start the Vite dev server
pnpm build        # production build
pnpm test         # run unit tests (vitest)
pnpm test:watch   # vitest in watch mode
pnpm test:e2e     # Playwright browser smoke tests (config/playwright.config.ts)
```

## Project layout

```
src/app/
  components/        feature components (+ ui/ for Radix/shadcn primitives)
  contexts/          auth + food-type React contexts
  data/              static/reference datasets (lexicon, attributes, samples)
  lib/               data-access layer (Supabase mappers), query client, hooks
  utils/             pure domain logic (decision engine, metrics, exports)
  routes.tsx         route tree + role guards
supabase/
  migrations/        schema + RLS policies (timestamp-ordered)
  functions/         edge functions (e.g. generate-concept-images)
```

## Roles

- **admin** — full platform: instrumental data, survey analysis, final decision, concept testing, configuration.
- **panelist** — only their own questionnaires at `/panelist`; cannot see other panelists' or admin data.

Access control is enforced server-side via Supabase RLS (see `supabase/migrations/*_rls_policies.sql`
and `*_security_fixes.sql`), not just client-side route guards.

## Further docs

- `DEMO_INSTRUCTIONS.md` — end-to-end walkthrough of the admin and panelist flows.
- `AGENTS.md` / `CLAUDE.md` — operating guides for AI coding assistants working in this repo.
- `docs/operations-runbook.md` — branded tenant setup, health checks, cost controls, backups, and rollback.
