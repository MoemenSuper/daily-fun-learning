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

Production API calls from the notification client require a registered device ID and a high-entropy credential. D1 stores only its SHA-256 hash. Clicking a notification creates a five-minute, single-use opening token; exchanging it creates a 12-hour Secure, HTTP-only, SameSite session cookie. The localhost development command uses an explicit browser-session bypass, while the default Wrangler configuration remains in production mode.

## Deliberately deferred

- No autonomous lesson generator or paid AI provider.
- No R2, queues, cron triggers, local server, or background agent.
- No multi-user abstractions.
- Repository exercises are curated records, not continuous GitHub scanning.
