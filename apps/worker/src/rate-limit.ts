export async function allowRequest(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
  now = Date.now(),
): Promise<boolean> {
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds
  const result = await db
    .prepare(
      `INSERT INTO request_limits (key, window_start, request_count)
       VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET
         request_count = CASE
           WHEN request_limits.window_start = excluded.window_start
             THEN request_limits.request_count + 1
           ELSE 1
         END,
         window_start = excluded.window_start
       RETURNING request_count`,
    )
    .bind(key, windowStart)
    .first<{ request_count: number }>()
  return (result?.request_count ?? limit + 1) <= limit
}
