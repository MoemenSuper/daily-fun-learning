# Daily Learning Guide

A private, lightweight learning app designed to deliver one calm computer-science lesson per day without leaving a process running on the laptop.

## Current status

The local vertical slice is working: one seeded lesson, Africa/Tunis delivery timing, same-day duplicate prevention, ignored-lesson repetition, a React lesson view, a deep explanation, and a comprehension check. It is intentionally **not ready for public deployment** until device authentication and single-use browser sessions are complete.

## Architecture

- React and Vite for the hosted lesson interface
- Hono on Cloudflare Workers for the API
- Cloudflare D1 for lessons, progress, delivery claims, quizzes, and reviews
- One Worker Static Assets deployment for both UI and API
- A future short-lived C# Windows notification client launched by Task Scheduler

See [docs/architecture.md](docs/architecture.md) for runtime ownership and state transitions.

## Prerequisites

- Node.js 22.12 or newer
- npm 10 or newer

Wrangler is installed locally by `npm install`; a global installation is not needed.

## Local development

```powershell
npm install
npm run db:migrate:local
npm run db:seed:local
npm run build --workspace @daily-learning/web
npm run dev
```

Open `http://localhost:8787`.

Run verification:

```powershell
npm run typecheck
npm test
npm run build
```

## Cloudflare account setup

No dashboard setup is needed yet. Once production authentication is implemented and tested, deployment will use Wrangler:

1. Run `npx wrangler login` and approve the browser authorization.
2. Create the free D1 database with `npx wrangler d1 create daily-learning-guide`.
3. Put the returned database ID in `apps/worker/wrangler.jsonc`.
4. Apply migrations and seed content to the remote database.
5. Deploy the Worker and its static assets.

These steps must not be run against the cloud yet. The present local-only API does not contain the production authentication boundary.

## Repository layout

```text
apps/web/       React lesson interface
apps/worker/    Hono API and Worker configuration
docs/           Architecture and operating documentation
migrations/     Ordered D1 schema migrations
scripts/        Repeatable seed data
```

Generated output, local D1 state, Wrangler credentials, and local variables are excluded from Git.
