# Architecture

## Deployment shape

Version one uses one Cloudflare Worker deployment. Hono handles `/api/*`; Cloudflare Static Assets serves the compiled React application; D1 stores curriculum and progress. Keeping the UI and API on one origin avoids CORS, a second deployment, and permanent browser credentials.

The Windows client is a short-lived native executable launched by Task Scheduler. It calls the delivery endpoint, displays a notification only when the backend grants that day's delivery claim, and exits. Clicking the notification asks the backend for a single-use opening token and opens the hosted UI. No local server or background process is used.

## Runtime ownership

- D1 is authoritative for the active lesson, delivery claims, completion, and review scheduling.
- The Worker owns state transitions and rejects invalid transitions.
- The browser renders lessons and submits explicit actions; it never holds a permanent device secret.
- The Windows client owns only notification display and activation.

## Lesson states

```text
pending -> notified -> opened -> quiz_pending -> completed
                    \-> review_later -> scheduled_for_review
quiz_pending --------> review_later
quiz_pending --------> completed -> scheduled_for_review (incorrect answer)
```

`notified` is not completion. A unique `(learning_date, device_id)` delivery row provides the daily idempotency boundary. Ignoring a notification leaves the same lesson active, so a new date may claim and notify it again.

## Authentication boundary

Before cloud deployment, the local vertical slice is intentionally accessible only on localhost. Production deployment is blocked until device registration, hashed credential verification, single-use opening tokens, and HTTP-only sessions are implemented and tested. This avoids disguising a development bypass as production security.

## Deliberately deferred

- No autonomous lesson generator or paid AI provider.
- No R2, queues, cron triggers, local server, or background agent.
- No multi-user abstractions.
- Repository exercises are curated records, not continuous GitHub scanning.

