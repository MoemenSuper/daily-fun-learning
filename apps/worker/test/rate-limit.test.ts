import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import { allowRequest } from '../src/rate-limit'

const db = (env as unknown as { DB: D1Database }).DB

describe('request rate limits', () => {
  beforeEach(async () => {
    await db.prepare('DELETE FROM request_limits').run()
  })

  it('rejects requests above the limit in the same window', async () => {
    expect(await allowRequest(db, 'test', 2, 60, 1_000)).toBe(true)
    expect(await allowRequest(db, 'test', 2, 60, 2_000)).toBe(true)
    expect(await allowRequest(db, 'test', 2, 60, 3_000)).toBe(false)
  })

  it('starts a fresh count in the next window', async () => {
    expect(await allowRequest(db, 'test', 1, 60, 1_000)).toBe(true)
    expect(await allowRequest(db, 'test', 1, 60, 2_000)).toBe(false)
    expect(await allowRequest(db, 'test', 1, 60, 61_000)).toBe(true)
  })
})
