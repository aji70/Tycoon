# Monitoring with Sentry

**Last updated:** March 2026

Error tracking and optional APM are wired for backend and frontend via [Sentry](https://sentry.io/). When DSN is not set, the app runs as before; no Sentry code runs.

## Backend (Node/Express)

- **Package:** `@sentry/node`
- **Init:** In `server.js`, Sentry is initialized only when `SENTRY_DSN` is set.
- **Middleware:** `requestHandler`, `tracingHandler`, and `errorHandler` are registered when DSN is set. Unhandled errors and request traces are sent to Sentry.

**Env (backend):**

- `SENTRY_DSN` — DSN from your Sentry project (backend). Omit to disable.

## Frontend (Next.js)

- **Package:** `@sentry/nextjs`
- **Config:** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` initialize Sentry only when a DSN is present.
- **Build:** `next.config.mjs` is wrapped with `withSentryConfig`. Optional: set `SENTRY_ORG` and `SENTRY_PROJECT` for source maps / release uploads.

**Env (frontend):**

- `NEXT_PUBLIC_SENTRY_DSN` — DSN for browser (and optionally server) error reporting. Omit to disable.
- `SENTRY_DSN` — Optional; used by server/edge config if set.
- `SENTRY_ORG` / `SENTRY_PROJECT` — Optional; for Sentry CLI (e.g. release uploads).

## Setup

1. Create a project at [sentry.io](https://sentry.io/) for backend and one for frontend (or use one project for both).
2. Copy the DSN from each project.
3. **Backend:** set `SENTRY_DSN` in your backend env (e.g. `.env` or Railway).
4. **Frontend:** set `NEXT_PUBLIC_SENTRY_DSN` in your frontend env (e.g. `.env.local` or Vercel).

No code changes are required for basic error reporting; unhandled errors are captured automatically.
