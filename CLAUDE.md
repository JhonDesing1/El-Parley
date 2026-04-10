# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ApuestaValue** is a full-stack sports betting value detection platform targeting Colombia/LATAM. It identifies mathematically profitable betting opportunities (value bets) and curated parlays across multiple bookmakers.

**Stack:** Next.js 15 (App Router) + TypeScript + Supabase + Tailwind/Shadcn + TanStack Query v5

## Commands

```bash
npm run dev          # Dev server (Turbo)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # tsc strict mode
npm run format       # Prettier
npm run db:types     # Regenerate Supabase TypeScript types (run after schema changes)
npm run db:push      # Apply migrations to Supabase
npm run db:reset     # ⚠️ Destructive: reset local database
```

There is no test suite currently.

## Architecture

### Route Groups

- `src/app/(marketing)/` — Public pages (home, landing, SEO content)
- `src/app/(app)/` — Protected routes; auth enforced via `src/middleware.ts`
- `src/app/(auth)/` — Login/auth flow
- `src/app/api/` — Backend routes: cron jobs, Stripe/PayU webhooks, affiliate tracking

### Core Business Logic (`src/lib/betting/`)

This is the mathematical core of the platform — treat with care:

- `implied-probability.ts` — Converts bookmaker odds to probabilities (Multiplicative & Shin's method)
- `value-bet.ts` — Detects value by comparing implied probabilities against the Poisson model; edge threshold is ≥3%
- `poisson.ts` — Poisson distribution model using xG data for match outcome probabilities
- `kelly.ts` — Kelly Criterion for optimal stake sizing
- `parlay-calculator.ts` — Multi-leg parlay math

Do not modify these files without a solid understanding of the underlying math — they are the IP of the platform.

### Data Flow

1. **Cron jobs** (Vercel, every 10 min / 6h) → fetch from API-Football → upsert to Supabase
2. **Supabase Edge Functions** (`detect-value-bets`, `generate-parlays`) run on pg_cron schedules
3. **Frontend RSC components** query Supabase directly (server components) or via TanStack Query (client)
4. **Premium gate** — `isPremiumUser()` in `src/lib/utils/` checks subscription before serving premium data

### Auth & Middleware

Supabase handles sessions. `src/middleware.ts` refreshes auth tokens on every request and redirects unauthenticated users away from `(app)` routes. Use the server client (`src/lib/supabase/server.ts`) in RSCs and the service-role admin client (`src/lib/supabase/admin.ts`) only in cron/API routes — never expose the service key to the client.

### Payments

- **Stripe** — global subscriptions (USD); webhook at `/api/webhooks/stripe`
- **PayU** — Colombia (COP); separate checkout flow
- Keep both payment paths functional; they write to the same `subscriptions` table

### External API Constraints

API-Football free tier = 100 req/day. Cron jobs batch with `Promise.allSettled` to avoid failures cascading. If adding new API calls, be mindful of this limit.

### Database

Three migrations in `supabase/migrations/`:
1. `00001_init.sql` — 17 tables (matches, odds, leagues, teams, profiles, subscriptions, value_bets, parlays, etc.)
2. `00002_rls.sql` — Row-level security policies
3. `00003_functions.sql` — Triggers + RPC functions (auto-profile creation, `implied_prob`, etc.)

Always run `npm run db:types` after any schema change to keep `src/types/database.ts` in sync.

### Configuration

- `src/config/site.ts` — SEO metadata, social links
- `src/config/bookmakers.ts` — Bookmaker config and affiliate URLs (driven by `NEXT_PUBLIC_*_AFF` env vars)
- `vercel.json` — Cron schedules
- `.env.example` — Authoritative list of all required environment variables with explanations
