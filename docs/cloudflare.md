# Cloudflare deployment and operations

The application uses only Workers Free, D1 Free, and Worker Static Assets. It does not require a custom domain, R2, a payment card, or a paid AI service.

Production is deployed at `https://daily-fun-learning.ouerghuimoemej.workers.dev`. The D1 database is in Cloudflare's Eastern Europe region, and the Windows client is installed through the `Daily Learning Guide` scheduled task.

## First deployment

From the repository root:

```powershell
cd apps\worker
npx wrangler login
cd ..\..
.\scripts\deploy-cloudflare.ps1 `
  -RegistrationSecret (Read-Host 'Temporary device-registration secret' -AsSecureString)
```

Approve only the Cloudflare browser authorization. The deployment script then:

1. verifies the authenticated account;
2. creates `daily-learning-guide` D1 in Eastern Europe when it does not exist;
3. updates the `DB` binding in `wrangler.jsonc`;
4. applies ordered migrations remotely;
5. seeds the 14-lesson curriculum idempotently;
6. deploys the Worker and React static assets;
7. uploads the registration secret through a randomly named temporary JSON file, removes that file in `finally`, and never writes it to the repository or Git.

Use the `workers.dev` URL printed by Wrangler when running `scripts\install-windows.ps1`.

## Production checks

```powershell
Invoke-RestMethod 'https://YOUR-WORKER.workers.dev/api/health'
```

Expected response:

```json
{"ok":true}
```

Unauthenticated private content must return HTTP 401:

```powershell
Invoke-WebRequest 'https://YOUR-WORKER.workers.dev/api/lessons/current'
```

After Windows installation, run the scheduled client twice. The first eligible run may notify; the second must exit without a duplicate.

## Migrations and seed updates

```powershell
cd apps\worker
npx wrangler d1 migrations apply daily-learning-guide --remote
npx wrangler d1 execute daily-learning-guide --remote --file ../../scripts/seed.sql
```

Never edit the remote schema manually. Add a numbered migration under `migrations/` and apply it through Wrangler.

## Backup

```powershell
.\scripts\backup-d1.ps1
```

Backups are written under the Git-ignored `backups/` directory. They contain personal learning history and should be protected accordingly.

## Troubleshooting

- `wrangler whoami --json` fails: run `npx wrangler login` from `apps\worker` and approve the browser prompt before it times out.
- D1 binding says `local`: inspect `apps\worker\wrangler.jsonc`; production must contain the UUID returned by `wrangler d1 create`.
- Worker returns 401: expected for private routes without a device credential or browser session. `/api/health` remains public.
- Client exits with code 1: inspect `%LOCALAPPDATA%\DailyLearningGuide\client-errors.log`.
- No notification appears: run the fixture `DailyLearningGuide.exe --test-notification`, then check Windows Settings → System → Notifications.
- Duplicate notification concern: inspect `daily_deliveries`; its `(learning_date, device_id)` primary key is the backend idempotency boundary.
- Scheduled task does not run: inspect `Get-ScheduledTaskInfo -TaskName 'Daily Learning Guide'` and confirm the task points to `%LOCALAPPDATA%\DailyLearningGuide\DailyLearningGuide.exe`.

## Registration-secret handling

The secret exists only to authorize device registration or reset. It is not the device credential and is never sent to the browser. For the smallest attack surface, delete it after a successful Windows installation:

```powershell
cd apps\worker
npx wrangler secret delete DEVICE_REGISTRATION_SECRET
```

To reset later, upload a new temporary secret, run `scripts\reset-device.ps1` with the same value, then delete the Worker secret again.
