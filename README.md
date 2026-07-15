# Daily Learning Guide

A private, lightweight learning app designed to deliver one calm computer-science lesson per day without leaving a process running on the laptop.

## Current status

The complete local curriculum flow is working: 14 sourced lessons across related theory and practice phases, Africa/Tunis delivery timing, duplicate prevention, ignored-lesson repetition, deep explanations, quizzes with feedback, review later, weekly reviews, profile editing, device authentication, and single-use browser sessions.

It is intentionally **not deployed yet**. Local implementation and resource measurements are complete; Cloudflare browser authorization, production smoke tests, and final Windows installation remain.

## Architecture

- React and Vite for the hosted lesson interface
- Hono on Cloudflare Workers for the API
- Cloudflare D1 for lessons, progress, delivery claims, quizzes, and reviews
- One Worker Static Assets deployment for both UI and API
- A short-lived C# Windows notification client launched by Task Scheduler

See [docs/architecture.md](docs/architecture.md) for runtime ownership and state transitions.
See [docs/windows-client.md](docs/windows-client.md) for installation and notification testing, and [docs/resource-measurements.md](docs/resource-measurements.md) for measured footprint and runtime use.
See [docs/cloudflare.md](docs/cloudflare.md) for deployment, production checks, D1 backup, and troubleshooting.

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
.\scripts\publish-windows.ps1
```

## Cloudflare account setup

No dashboard setup is needed yet. Once production authentication is implemented and tested, deployment will use Wrangler:

1. Run `npx wrangler login` and approve the browser authorization.
2. Create the free D1 database with `npx wrangler d1 create daily-learning-guide`.
3. Put the returned database ID in `apps/worker/wrangler.jsonc`.
4. Apply migrations and seed content to the remote database.
5. Deploy the Worker and its static assets.

The deployment steps are performed only after the complete local test suite passes. The default Worker configuration enforces production authentication; only `npm run dev` opts into the localhost browser-session bypass.

## Repository layout

```text
apps/web/       React lesson interface
apps/worker/    Hono API and Worker configuration
apps/windows-client/  Short-lived native C# notification client
docs/           Architecture and operating documentation
migrations/     Ordered D1 schema migrations
scripts/        Repeatable seed data
```

Generated output, local D1 state, Wrangler credentials, and local variables are excluded from Git.
