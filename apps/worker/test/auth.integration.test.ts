import { env } from 'cloudflare:workers'
import { beforeEach, describe, expect, it } from 'vitest'
import app from '../src/index'
import type { Bindings } from '../src/types'

const credential = 'a'.repeat(43)
const deviceAuthorization = `Device test-device:${credential}`
const testEnv = env as unknown as Bindings

async function registerDevice() {
  return app.request(
    '/api/devices/register',
    {
      method: 'POST',
      headers: {
        authorization: 'Bearer bootstrap-test-secret',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ deviceId: 'test-device', credential }),
    },
    testEnv,
  )
}

describe('private device authentication', () => {
  beforeEach(async () => {
    await testEnv.DB.batch([
      testEnv.DB.prepare('DELETE FROM browser_sessions'),
      testEnv.DB.prepare('DELETE FROM opening_tokens'),
      testEnv.DB.prepare('DELETE FROM daily_deliveries'),
      testEnv.DB.prepare('DELETE FROM devices'),
      testEnv.DB.prepare('DELETE FROM lesson_progress'),
    ])
  })

  it('rejects registration without the bootstrap secret', async () => {
    const response = await app.request(
      '/api/devices/register',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deviceId: 'unauthorized-device', credential }),
      },
      testEnv,
    )
    expect(response.status).toBe(401)
  })

  it('authenticates delivery checks and prevents a duplicate claim', async () => {
    expect((await registerDevice()).status).toBe(201)
    const request = () =>
      app.request(
        '/api/delivery/check',
        {
          method: 'POST',
          headers: { authorization: deviceAuthorization, 'content-type': 'application/json' },
          body: JSON.stringify({ deviceId: 'test-device' }),
        },
        testEnv,
      )

    const first = await request()
    const second = await request()
    expect(first.status).toBe(200)
    expect(await first.json()).toMatchObject({ shouldNotify: true })
    expect(await second.json()).toMatchObject({ shouldNotify: false, reason: 'already_claimed_today' })
  })

  it('exchanges an opening token only once for an HTTP-only session', async () => {
    await registerDevice()
    const tokenResponse = await app.request(
      '/api/opening-tokens',
      { method: 'POST', headers: { authorization: deviceAuthorization } },
      testEnv,
    )
    expect(tokenResponse.status).toBe(200)
    const { url } = (await tokenResponse.json()) as { url: string }

    const firstExchange = await app.request(url, undefined, testEnv)
    expect(firstExchange.status).toBe(302)
    expect(firstExchange.headers.get('set-cookie')).toContain('HttpOnly')
    expect(firstExchange.headers.get('set-cookie')).toContain('Secure')

    const replay = await app.request(url, undefined, testEnv)
    expect(replay.status).toBe(401)
  })

  it('rejects expired opening tokens', async () => {
    await registerDevice()
    const expiredHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('expired-token'),
    )
    const hash = Array.from(new Uint8Array(expiredHash), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
    await testEnv.DB.prepare(
      `INSERT INTO opening_tokens (token_hash, device_id, lesson_id, expires_at)
       VALUES (?, 'test-device', 1, '2000-01-01T00:00:00.000Z')`,
    )
      .bind(hash)
      .run()
    const response = await app.request('/open?token=expired-token', undefined, testEnv)
    expect(response.status).toBe(401)
  })
})
